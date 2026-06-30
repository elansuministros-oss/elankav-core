/* eslint-disable no-console */

import * as XLSX from "xlsx";
import { downloadStorageFile } from "../lib/emc/storage-engine.js";
import { extractPdfPages } from "../lib/emc/pdf-engine.js";
import { processPageSafe } from "../lib/emc/page-engine.js";
import { analyzeImageProducts } from "../lib/emc/vision-engine.js";

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

const ALLOWED_ORIGINS = new Set([
  "https://visual.elankav.com",
  "https://elankav-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function cors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED_ORIGINS.has(origin) ? origin : "https://visual.elankav.com"
  );
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function pagesFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  return workbook.SheetNames.map((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const text = rows
      .map((row) => row.map((cell) => String(cell || "").trim()).filter(Boolean).join(" | "))
      .filter(Boolean)
      .join("\n");

    return {
      pagina: index + 1,
      hoja: sheetName,
      text,
      chars: text.length,
    };
  }).filter((page) => page.text);
}

function pagesFromText(buffer) {
  const text = buffer.toString("utf8").trim();
  return text ? [{ pagina: 1, text, chars: text.length }] : [];
}

async function processDownloadedFile({ file, proveedor, guardarAutomatico, context }) {
  const result = {
    name: file.name,
    mime: file.mime,
    type: file.type,
    bucket: file.bucket,
    path: file.path,
    size: file.size,
    paginas_total: 0,
    paginas: [],
    total_items: 0,
    total_guardados: 0,
    errores: [],
  };

  if (file.type === "pdf") {
    const pdf = await extractPdfPages(file.buffer);
    result.paginas_total = pdf.total_pages;

    for (const page of pdf.pages) {
      const pageResult = await processPageSafe({
        proveedor,
        archivo: file,
        pagina: page.pagina,
        text: page.text,
        context,
        guardarAutomatico,
      });

      result.paginas.push(pageResult);
      result.total_items += Number(pageResult.items_detectados || 0);
      result.total_guardados += Number(pageResult.items_guardados || 0);

      if (!pageResult.ok) {
        result.errores.push({ pagina: page.pagina, error: pageResult.error });
      }
    }

    return result;
  }

  if (file.type === "excel") {
    const pages = pagesFromExcel(file.buffer);
    result.paginas_total = pages.length;

    for (const page of pages) {
      const pageResult = await processPageSafe({
        proveedor,
        archivo: file,
        pagina: page.pagina,
        text: page.text,
        context: { ...context, hoja: page.hoja },
        guardarAutomatico,
      });

      result.paginas.push(pageResult);
      result.total_items += Number(pageResult.items_detectados || 0);
      result.total_guardados += Number(pageResult.items_guardados || 0);

      if (!pageResult.ok) {
        result.errores.push({ pagina: page.pagina, hoja: page.hoja, error: pageResult.error });
      }
    }

    return result;
  }

  if (file.type === "csv" || file.type === "txt") {
    const pages = pagesFromText(file.buffer);
    result.paginas_total = pages.length;

    for (const page of pages) {
      const pageResult = await processPageSafe({
        proveedor,
        archivo: file,
        pagina: page.pagina,
        text: page.text,
        context,
        guardarAutomatico,
      });

      result.paginas.push(pageResult);
      result.total_items += Number(pageResult.items_detectados || 0);
      result.total_guardados += Number(pageResult.items_guardados || 0);

      if (!pageResult.ok) {
        result.errores.push({ pagina: page.pagina, error: pageResult.error });
      }
    }

    return result;
  }

  if (file.type === "image") {
    result.paginas_total = 1;

    const vision = await analyzeImageProducts({
      buffer: file.buffer,
      mime: file.mime || "image/png",
      context,
    });

    const pageResult = await processPageSafe({
      proveedor,
      archivo: file,
      pagina: 1,
      visionResult: vision,
      context,
      guardarAutomatico,
    });

    result.paginas.push(pageResult);
    result.total_items += Number(pageResult.items_detectados || 0);
    result.total_guardados += Number(pageResult.items_guardados || 0);

    if (!vision.ok) {
      result.errores.push({ pagina: 1, error: vision.error });
    }

    if (!pageResult.ok) {
      result.errores.push({ pagina: 1, error: pageResult.error });
    }

    return result;
  }

  result.errores.push({ error: `Tipo de archivo no soportado: ${file.type}` });
  return result;
}

export default async function handler(req, res) {
  cors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      endpoint: "/api/emc-import",
      version: "AI-22-EMC-IMPORTADOR-NUEVO",
      status: "ready",
    });
  }

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "Metodo no permitido." });
  }

  try {
    const body = req.body || {};
    const proveedor = body.proveedor || {};
    const archivos = Array.isArray(body.archivos) ? body.archivos : [];
    const guardarAutomatico = Boolean(body.guardar_automatico || body.guardarAutomatico);

    if (!proveedor?.id) {
      return send(res, 400, { ok: false, error: "Falta proveedor.id." });
    }

    if (!archivos.length) {
      return send(res, 400, { ok: false, error: "Faltan archivos para importar." });
    }

    const resultados = [];

    for (const archivo of archivos) {
      try {
        const file = await downloadStorageFile(archivo);

        const resultado = await processDownloadedFile({
          file,
          proveedor,
          guardarAutomatico,
          context: {
            proveedor_id: proveedor.id,
            proveedor_nombre: proveedor.nombre || proveedor.name || "",
          },
        });

        resultados.push(resultado);
      } catch (error) {
        resultados.push({
          name: archivo.nombre || archivo.name || archivo.storage_path || "archivo",
          ok: false,
          error: error.message || "Error procesando archivo EMC.",
          paginas_total: 0,
          paginas: [],
          total_items: 0,
          total_guardados: 0,
          errores: [{ error: error.message || "Error procesando archivo EMC." }],
        });
      }
    }

    return send(res, 200, {
      ok: true,
      tipo: "emc-import-ai-22",
      proveedor,
      guardar_automatico: guardarAutomatico,
      resumen: {
        archivos: resultados.length,
        paginas: resultados.reduce((sum, item) => sum + Number(item.paginas_total || 0), 0),
        items_detectados: resultados.reduce((sum, item) => sum + Number(item.total_items || 0), 0),
        items_guardados: resultados.reduce((sum, item) => sum + Number(item.total_guardados || 0), 0),
        errores: resultados.reduce((sum, item) => sum + Number(item.errores?.length || 0), 0),
      },
      resultados,
    });
  } catch (error) {
    console.error("ERROR /api/emc-import:", error);

    return send(res, 500, {
      ok: false,
      endpoint: "/api/emc-import",
      error: error.message || "Error interno importando EMC.",
    });
  }
}