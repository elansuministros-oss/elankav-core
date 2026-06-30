/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

const JOBS = global.__EMC_VISION_JOBS__ || new Map();
global.__EMC_VISION_JOBS__ = JOBS;

function nowISO() {
  return new Date().toISOString();
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    return null;
  }
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function parseJsonOrText(req) {
  const raw = await readRawBody(req);
  const text = raw.toString("utf8");

  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { texto: text };
  }
}

async function parseMultipart(req) {
  const formidableModule = safeRequire("formidable");

  if (!formidableModule) {
    throw new Error("Multipart recibido, pero formidable no está disponible.");
  }

  const formidable =
    typeof formidableModule === "function"
      ? formidableModule
      : formidableModule.formidable;

  return await new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 80 * 1024 * 1024,
    });

    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);

      const normalizedFields = {};
      Object.entries(fields || {}).forEach(([key, value]) => {
        normalizedFields[key] = Array.isArray(value) ? value[0] : value;
      });

      const normalizedFiles = {};
      Object.entries(files || {}).forEach(([key, value]) => {
        normalizedFiles[key] = Array.isArray(value) ? value[0] : value;
      });

      resolve({
        ...normalizedFields,
        files: normalizedFiles,
      });
    });
  });
}

async function parseRequest(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    return await parseMultipart(req);
  }

  return await parseJsonOrText(req);
}

function getUploadedFile(payload) {
  const files = payload.files || {};
  return (
    files.archivo ||
    files.file ||
    files.pdf ||
    files.documento ||
    files.catalogo ||
    null
  );
}

function getFilePath(file) {
  return file?.filepath || file?.path || null;
}

function normalizeTipo(payload) {
  return String(payload.tipo || payload.action || payload.accion || "")
    .trim()
    .toLowerCase();
}

async function callFirstAvailable(mod, names, args) {
  if (!mod) return null;

  for (const name of names) {
    if (typeof mod[name] === "function") {
      return await mod[name](...args);
    }
  }

  if (typeof mod === "function") {
    return await mod(...args);
  }

  return null;
}

function createLocalJob(payload) {
  const jobId =
    "emc_job_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8);

  const job = {
    id: jobId,
    tipo: "emc-vision-import-v2",
    estado: "pendiente",
    proveedor_id: payload.proveedor_id || payload.proveedorId || null,
    proveedor_nombre: payload.proveedor_nombre || payload.proveedor || null,
    archivo_nombre: null,
    pagina_actual: 0,
    paginas_total: 0,
    porcentaje: 0,
    productos_detectados: 0,
    productos_guardados: 0,
    errores: 0,
    errores_detalle: [],
    tiempo_estimado_segundos: null,
    iniciado_en: nowISO(),
    actualizado_en: nowISO(),
    finalizado_en: null,
  };

  const file = getUploadedFile(payload);
  if (file) {
    job.archivo_nombre = file.originalFilename || file.newFilename || null;
    job.archivo_path = getFilePath(file);
    job.mime = file.mimetype || file.type || null;
  }

  JOBS.set(jobId, job);
  return job;
}

function updateJob(jobId, patch) {
  const previous = JOBS.get(jobId);
  if (!previous) return null;

  const next = {
    ...previous,
    ...patch,
    actualizado_en: nowISO(),
  };

  JOBS.set(jobId, next);
  return next;
}

async function runVisionJobInBackground(jobId, payload) {
  const jobEngine = safeRequire("../lib/emc/job-engine.js");

  updateJob(jobId, {
    estado: "procesando",
  });

  try {
    const result = await callFirstAvailable(
      jobEngine,
      [
        "procesarJobEMCVision",
        "procesarJob",
        "runJob",
        "startJob",
        "processJob",
        "default",
      ],
      [
        {
          jobId,
          payload,
          updateProgress: (patch) => updateJob(jobId, patch),
          getJob: () => JOBS.get(jobId),
        },
      ]
    );

    if (result) {
      updateJob(jobId, {
        ...result,
        estado: result.estado || "finalizado",
        porcentaje: result.porcentaje ?? 100,
        finalizado_en: nowISO(),
      });
    } else {
      updateJob(jobId, {
        estado: "finalizado",
        porcentaje: 100,
        finalizado_en: nowISO(),
      });
    }
  } catch (error) {
    const current = JOBS.get(jobId);

    updateJob(jobId, {
      estado: "finalizado_con_errores",
      errores: Number(current?.errores || 0) + 1,
      errores_detalle: [
        ...(current?.errores_detalle || []),
        {
          pagina: current?.pagina_actual || null,
          mensaje: error.message,
          fecha: nowISO(),
        },
      ],
      finalizado_en: nowISO(),
    });
  }
}

async function handleCrearJobEMC(req, res, payload) {
  const jobEngine = safeRequire("../lib/emc/job-engine.js");

  const externalJob = await callFirstAvailable(
    jobEngine,
    ["crearJobEMC", "crearJob", "createEmcJob", "createJob"],
    [payload]
  );

  const job = externalJob?.id ? externalJob : createLocalJob(payload);
  JOBS.set(job.id, { ...createLocalJob({}), ...job, id: job.id });

  runVisionJobInBackground(job.id, payload);

  return json(res, 200, {
    ok: true,
    tipo: "crear-job-emc",
    job_id: job.id,
    job,
  });
}

async function handleEstadoJobEMC(req, res, payload) {
  const jobId = payload.job_id || payload.jobId || payload.id;

  if (!jobId) {
    return json(res, 400, {
      ok: false,
      error: "Falta job_id.",
    });
  }

  const jobEngine = safeRequire("../lib/emc/job-engine.js");

  const externalStatus = await callFirstAvailable(
    jobEngine,
    ["estadoJobEMC", "obtenerEstadoJob", "getJobStatus", "getJob"],
    [jobId]
  );

  const job = externalStatus || JOBS.get(jobId);

  if (!job) {
    return json(res, 404, {
      ok: false,
      error: "Job EMC no encontrado.",
      job_id: jobId,
    });
  }

  return json(res, 200, {
    ok: true,
    tipo: "estado-job-emc",
    job_id: jobId,
    job,
  });
}

async function handleImportarEMC(req, res, payload) {
  const importEngine = safeRequire("../lib/emc-import-engine.js");

  const result = await callFirstAvailable(
    importEngine,
    [
      "importarEMC",
      "importarCatalogoEMC",
      "procesarImportacionEMC",
      "processEMCImport",
      "default",
    ],
    [payload]
  );

  if (!result) {
    return json(res, 500, {
      ok: false,
      error: "No se encontró función compatible en lib/emc-import-engine.js",
    });
  }

  return json(res, 200, {
    ok: true,
    tipo: "importar-emc",
    ...result,
  });
}

async function handleGuardarEMC(req, res, payload) {
  const saveEngine = safeRequire("../lib/emc-save-engine.js");

  const result = await callFirstAvailable(
    saveEngine,
    [
      "guardarEMC",
      "guardarCatalogoEMC",
      "guardarItemsEMC",
      "saveEMC",
      "saveEMCItems",
      "default",
    ],
    [payload]
  );

  if (!result) {
    return json(res, 500, {
      ok: false,
      error: "No se encontró función compatible en lib/emc-save-engine.js",
    });
  }

  return json(res, 200, {
    ok: true,
    tipo: "guardar-emc",
    ...result,
  });
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return json(res, 200, {
        ok: true,
        service: "ELANKAV CORE AI",
        status: "online",
        version: "AI-20 EMC Vision Import v2",
      });
    }

    if (req.method !== "POST") {
      return json(res, 405, {
        ok: false,
        error: "Método no permitido.",
      });
    }

    const payload = await parseRequest(req);
    const tipo = normalizeTipo(payload);

    if (tipo === "crear-job-emc") {
      return await handleCrearJobEMC(req, res, payload);
    }

    if (tipo === "estado-job-emc") {
      return await handleEstadoJobEMC(req, res, payload);
    }

    if (tipo === "importar-emc") {
      return await handleImportarEMC(req, res, payload);
    }

    if (tipo === "guardar-emc") {
      return await handleGuardarEMC(req, res, payload);
    }

    return json(res, 400, {
      ok: false,
      error: "Tipo no soportado en api/elan-ai.js",
      tipo_recibido: tipo || null,
      tipos_soportados: [
        "importar-emc",
        "guardar-emc",
        "crear-job-emc",
        "estado-job-emc",
      ],
    });
  } catch (error) {
    console.error("ERROR /api/elan-ai:", error);

    return json(res, 500, {
      ok: false,
      error: error.message || "Error interno en ELANKAV CORE.",
    });
  }
}

module.exports = handler;