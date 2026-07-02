/* eslint-disable no-console */

import { createAI23Services } from "../lib/ai23/index.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const JOBS = global.__EMC_VISION_JOBS__ || new Map();
global.__EMC_VISION_JOBS__ = JOBS;

const ALLOWED_ORIGINS = new Set([
  "https://visual.elankav.com",
  "https://elankav-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const EMC_BUCKET = "emc-importaciones";

function nowISO() {
  return new Date().toISOString();
}

function applyCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://visual.elankav.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(req, res, status, payload) {
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return null;
  }
}

async function safeImport(modulePath) {
  return await import(modulePath);
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
  if (!formidableModule) throw new Error("Multipart recibido, pero formidable no está disponible.");

  const formidable = typeof formidableModule === "function" ? formidableModule : formidableModule.formidable;

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

      resolve({ ...normalizedFields, files: normalizedFiles });
    });
  });
}

async function parseRequest(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) return await parseMultipart(req);
  return await parseJsonOrText(req);
}

function normalizeTipo(payload = {}) {
  return String(payload.tipo || payload.action || payload.accion || "").trim().toLowerCase();
}

function getUploadedFile(payload = {}) {
  const files = payload.files || {};
  return files.archivo || files.file || files.pdf || files.documento || files.catalogo || null;
}

function getFilePath(file) {
  return file?.filepath || file?.path || null;
}

function cleanStoragePath(value = "") {
  let path = String(value || "").trim();
  if (!path) return "";

  path = path.replace(/^\/+/, "");
  path = path.replace(/^emc-importaciones\/+/, "");

  return path;
}

function getStoragePathFromPayload(payload = {}) {
  const file = getUploadedFile(payload);

  return cleanStoragePath(
    payload.storage_path ||
      payload.storagePath ||
      payload.archivo_path ||
      payload.archivoPath ||
      payload.path ||
      payload.ruta ||
      payload.url_storage ||
      payload.storageUrl ||
      file?.storage_path ||
      file?.storagePath ||
      file?.path_storage ||
      file?.archivo_path ||
      ""
  );
}

function getArchivoNombre(payload = {}) {
  const file = getUploadedFile(payload);

  return (
    payload.originalFilename ||
    payload.originalname ||
    payload.fileName ||
    payload.filename ||
    payload.nombre_archivo ||
    payload.archivo_nombre ||
    file?.originalFilename ||
    file?.originalname ||
    file?.newFilename ||
    file?.name ||
    "catalogo-emc.pdf"
  );
}

function getArchivoMime(payload = {}) {
  const file = getUploadedFile(payload);

  return (
    payload.mimetype ||
    payload.mimeType ||
    payload.mime ||
    payload.file_mime ||
    payload.mime_type ||
    file?.mimetype ||
    file?.type ||
    "application/pdf"
  );
}

async function downloadStorageBuffer(storagePath) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase no configurado en CORE para descargar Storage.");
  }

  const path = cleanStoragePath(storagePath);
  if (!path) throw new Error("Falta storage_path del archivo EMC.");

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${EMC_BUCKET}/${encodeURI(path).replace(/%2F/g, "/")}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`No se pudo descargar archivo de Storage: ${response.status} ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function prepararArchivosParaImportacion(payload = {}) {
  const archivos = [];

  const multipartFile = getUploadedFile(payload);
  const multipartPath = getFilePath(multipartFile);

  if (multipartFile && multipartPath) {
    archivos.push({
      originalFilename: getArchivoNombre(payload),
      mimetype: getArchivoMime(payload),
      filepath: multipartPath,
      size: multipartFile.size || 0,
      origen: "multipart",
    });
  }

  const storagePath = getStoragePathFromPayload(payload);

  if (storagePath) {
    const buffer = await downloadStorageBuffer(storagePath);

    archivos.push({
      originalFilename: getArchivoNombre(payload),
      mimetype: getArchivoMime(payload),
      buffer,
      size: buffer.length,
      storage_path: storagePath,
      origen: "supabase_storage",
    });
  }

  if (Array.isArray(payload.archivos)) {
    for (const item of payload.archivos) {
      const itemStoragePath = cleanStoragePath(
        item.storage_path || item.storagePath || item.archivo_path || item.path || item.ruta || ""
      );

      if (itemStoragePath) {
        const buffer = await downloadStorageBuffer(itemStoragePath);

        archivos.push({
          ...item,
          originalFilename:
            item.originalFilename || item.originalname || item.fileName || item.filename || item.nombre || getArchivoNombre(payload),
          mimetype: item.mimetype || item.mimeType || item.mime || getArchivoMime(payload),
          buffer,
          size: buffer.length,
          storage_path: itemStoragePath,
          origen: "supabase_storage",
        });
      } else {
        archivos.push(item);
      }
    }
  }

  return archivos;
}

async function callFirstAvailable(mod, names, args) {
  if (!mod) return null;

  for (const name of names) {
    if (typeof mod[name] === "function") return await mod[name](...args);
  }

  if (typeof mod.default === "function") return await mod.default(...args);
  if (typeof mod === "function") return await mod(...args);

  return null;
}

function createLocalJob(payload = {}) {
  const jobId = "emc_job_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const file = getUploadedFile(payload);

  const job = {
    id: jobId,
    tipo: "emc-vision-import-v2",
    estado: "pendiente",
    proveedor_id: payload.proveedor_id || payload.proveedorId || null,
    proveedor_nombre: payload.proveedor_nombre || payload.proveedor || null,
    archivo_nombre: file?.originalFilename || file?.newFilename || getArchivoNombre(payload),
    archivo_path: getFilePath(file) || getStoragePathFromPayload(payload) || null,
    mime: file?.mimetype || file?.type || getArchivoMime(payload),
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

  JOBS.set(jobId, job);
  return job;
}

function updateJob(jobId, patch) {
  const previous = JOBS.get(jobId);
  if (!previous) return null;

  const next = { ...previous, ...patch, actualizado_en: nowISO() };
  JOBS.set(jobId, next);
  return next;
}

async function runVisionJobInBackground(jobId, payload) {
  const jobEngine = await safeImport("../lib/emc/job-engine.js");

  updateJob(jobId, { estado: "procesando" });

  try {
    const result = await callFirstAvailable(
      jobEngine,
      ["procesarJobEMCVision", "procesarJob", "runJob", "startJob", "processJob", "default"],
      [{ jobId, payload, updateProgress: (patch) => updateJob(jobId, patch), getJob: () => JOBS.get(jobId) }]
    );

    updateJob(jobId, {
      ...(result || {}),
      estado: result?.estado || "finalizado",
      porcentaje: result?.porcentaje ?? 100,
      finalizado_en: nowISO(),
    });
  } catch (error) {
    const current = JOBS.get(jobId);

    updateJob(jobId, {
      estado: "finalizado_con_errores",
      errores: Number(current?.errores || 0) + 1,
      errores_detalle: [
        ...(current?.errores_detalle || []),
        { pagina: current?.pagina_actual || null, mensaje: error.message, fecha: nowISO() },
      ],
      finalizado_en: nowISO(),
    });
  }
}

async function handleCrearJobEMC(req, res, payload) {
  const jobEngine = await safeImport("../lib/emc/job-engine.js");

  const externalJob = await callFirstAvailable(jobEngine, ["crearJobEMC", "crearJob", "createEmcJob", "createJob"], [payload]);
  const job = externalJob?.id ? externalJob : createLocalJob(payload);

  JOBS.set(job.id, { ...job, actualizado_en: nowISO() });
  runVisionJobInBackground(job.id, payload);

  return json(req, res, 200, {
    ok: true,
    tipo: "crear-job-emc",
    job_id: job.id,
    job,
  });
}

async function handleEstadoJobEMC(req, res, payload) {
  const jobId = payload.job_id || payload.jobId || payload.id;

  if (!jobId) {
    return json(req, res, 400, { ok: false, error: "Falta job_id." });
  }

  const jobEngine = await safeImport("../lib/emc/job-engine.js");
  const externalStatus = await callFirstAvailable(jobEngine, ["estadoJobEMC", "obtenerEstadoJob", "getJobStatus", "getJob"], [jobId]);

  const job = externalStatus || JOBS.get(jobId);

  if (!job) {
    return json(req, res, 404, { ok: false, error: "Job EMC no encontrado.", job_id: jobId });
  }

  return json(req, res, 200, {
    ok: true,
    tipo: "estado-job-emc",
    job_id: jobId,
    job,
  });
}

async function handleImportarEMC(req, res, payload) {
  const importEngine = await safeImport("../lib/emc-import-engine.js");
  const archivos = await prepararArchivosParaImportacion(payload);
  const body = { ...payload, archivos };

  const result = await callFirstAvailable(
    importEngine,
    ["analizarImportacionEMC", "importarEMC", "importarCatalogoEMC", "procesarImportacionEMC", "processEMCImport", "default"],
    [{ body }]
  );

  if (!result) {
    return json(req, res, 500, {
      ok: false,
      error: "No se encontró función compatible en lib/emc-import-engine.js",
    });
  }

  return json(req, res, 200, {
    ok: result.ok !== false,
    tipo: "importar-emc",
    storage_descargado: archivos.some((a) => a.origen === "supabase_storage"),
    archivos_preparados: archivos.map((a) => ({
      nombre: a.originalFilename || a.name || "archivo",
      mime: a.mimetype || a.mime || "",
      size: a.size || 0,
      origen: a.origen || "payload",
      storage_path: a.storage_path || null,
      tiene_buffer: Boolean(a.buffer),
      tiene_filepath: Boolean(a.filepath),
    })),
    ...result,
  });
}

async function handleGuardarEMC(req, res, payload) {
  const saveEngine = await safeImport("../lib/emc-save-engine.js");

  const result = await callFirstAvailable(
    saveEngine,
    ["guardarEMC", "guardarCatalogoEMC", "guardarItemsEMC", "saveEMC", "saveEMCItems", "default"],
    [payload]
  );

  if (!result) {
    return json(req, res, 500, {
      ok: false,
      error: "No se encontró función compatible en lib/emc-save-engine.js",
    });
  }

  return json(req, res, 200, {
    ok: true,
    tipo: "guardar-emc",
    ...result,
  });
}

async function handleAI23MotorCostos(req, res, payload) {
  const ai23 = createAI23Services();

  const modo = String(payload.modo || payload.metodo || "").trim().toLowerCase();

  const calculoPayload = {
    componentes: Array.isArray(payload.componentes) ? payload.componentes : [],
    adicionales: Array.isArray(payload.adicionales) ? payload.adicionales : [],
    mano_obra: payload.mano_obra ?? payload.manoObra ?? 0,
    indirectos: payload.indirectos ?? 0,
    margen_porcentaje: payload.margen_porcentaje ?? payload.margenPorcentaje ?? 0,
    moneda: payload.moneda || "USD",
    tipo_cambio: payload.tipo_cambio ?? payload.tipoCambio ?? null,
  };

  const resultado =
    modo === "combinacion" || payload.combinacion_id || payload.combinacionId
      ? await ai23.motorCostos.calcularCombinacion({
          ...calculoPayload,
          combinacion_id: payload.combinacion_id ?? payload.combinacionId,
        })
      : ai23.motorCostos.calcularManual(calculoPayload);

  if (!resultado?.ok) {
    return json(req, res, 400, {
      ok: false,
      tipo: "ai23-motor-costos",
      fuente_costos: "AI-23",
      error: resultado?.message || resultado?.error || "AI-23 no pudo calcular el costo.",
      detalle: resultado,
    });
  }

  const data = resultado.data || {};
  const resumen = data.resumen || {};

  return json(req, res, 200, {
    ok: true,
    tipo: "ai23-motor-costos",
    fuente_costos: "AI-23",
    moneda: data.moneda || calculoPayload.moneda,
    tipo_cambio: data.tipo_cambio,
    total_usd: resumen.total_usd,
    total_nio: resumen.total_nio,
    total: resumen.total,
    resumen,
    componentes: data.componentes || [],
    adicionales: data.adicionales || [],
    combinacion: data.combinacion || null,
    respuesta: `Costo calculado con AI-23. Total USD: ${resumen.total_usd ?? "N/D"} / Total C$: ${resumen.total_nio ?? "N/D"}. Tipo de cambio usado: ${data.tipo_cambio ?? "no aplicado"}.`,
  });
}

async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET") {
      return json(req, res, 200, {
        ok: true,
        service: "ELANKAV CORE AI",
        status: "online",
        version: "AI-23 P06 Motor IA",
      });
    }

    if (req.method !== "POST") {
      return json(req, res, 405, {
        ok: false,
        error: "Método no permitido.",
      });
    }

    const payload = await parseRequest(req);
    const tipo = normalizeTipo(payload);

    if (tipo === "crear-job-emc") return await handleCrearJobEMC(req, res, payload);
    if (tipo === "estado-job-emc") return await handleEstadoJobEMC(req, res, payload);
    if (tipo === "importar-emc") return await handleImportarEMC(req, res, payload);
    if (tipo === "guardar-emc") return await handleGuardarEMC(req, res, payload);

    if (
      tipo === "ai23-motor-costos" ||
      tipo === "calcular-costo-ai23" ||
      tipo === "cotizar-ai23" ||
      tipo === "costo-ai"
    ) {
      return await handleAI23MotorCostos(req, res, payload);
    }

    return json(req, res, 400, {
      ok: false,
      error: "Tipo no soportado en api/elan-ai.js",
      tipo_recibido: tipo || null,
      tipos_soportados: [
        "importar-emc",
        "guardar-emc",
        "crear-job-emc",
        "estado-job-emc",
        "ai23-motor-costos",
        "calcular-costo-ai23",
        "cotizar-ai23",
        "costo-ai",
      ],
    });
  } catch (error) {
    console.error("ERROR /api/elan-ai:", error);

    return json(req, res, 500, {
      ok: false,
      error: error.message || "Error interno en ELANKAV CORE.",
    });
  }
}

export default handler;
