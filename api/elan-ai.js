import { guardarEMC } from "../lib/emc-save-engine.js";
import OpenAI from "openai";
import formidable from "formidable";
import { crearClienteSupabase } from "../lib/memoria-operativa.js";

export const config = {
  api: {
    bodyParser: false
  }
};

let supabase;

try {
  supabase = crearClienteSupabase();
} catch {
  supabase = null;
}

/* =========================
   CORS
========================= */

const allowedOrigins = [
  "https://visual.elankav.com",
  "https://elanvisual-platform.vercel.app",
  "https://elankav-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174"
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://visual.elankav.com";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

/* =========================
   BODY HELPERS
========================= */

function esMultipart(req) {
  return String(req.headers["content-type"] || "").includes("multipart/form-data");
}

function leerBodyRaw(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function leerBodyJson(req) {
  const raw = await leerBodyRaw(req);

  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function valorCampo(valor) {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function normalizarFiles(files = {}) {
  const salida = [];

  Object.values(files || {}).forEach((valor) => {
    if (Array.isArray(valor)) {
      salida.push(...valor);
    } else if (valor) {
      salida.push(valor);
    }
  });

  return salida;
}

function leerBodyMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024,
      maxTotalFileSize: 40 * 1024 * 1024
    });

    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      const body = {};

      Object.entries(fields || {}).forEach(([key, value]) => {
        const limpio = valorCampo(value);

        if (key === "proveedor") {
          try {
            body.proveedor = JSON.parse(limpio || "{}");
          } catch {
            body.proveedor = {};
          }
        } else {
          body[key] = limpio;
        }
      });

      body.archivos = normalizarFiles(files);

      resolve(body);
    });
  });
}

async function leerBody(req) {
  if (esMultipart(req)) {
    return leerBodyMultipart(req);
  }

  return leerBodyJson(req);
}

/* =========================
   EMC GUARDAR
========================= */

async function manejarGuardarEMC(body, supabaseClient) {
  try {
    if (!supabaseClient) {
      return {
        ok: false,
        error: "Supabase no inicializado en CORE"
      };
    }

    const resultado = await guardarEMC(body, supabaseClient);

    return {
      ok: true,
      version: "AI-19-EMC",
      resultado
    };
  } catch (error) {
    console.error("guardar-emc error:", error);

    return {
      ok: false,
      error: error.message
    };
  }
}

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "ELANKAV CORE AI",
      endpoint: "/api/elan-ai",
      status: "online",
      version: "AI-19-MULTIPART-EMC",
      soporta: ["chat", "render-botones", "importar-emc", "guardar-emc"]
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido"
    });
  }

  try {
    const body = await leerBody(req);
    const tipo = String(body.tipo || "").trim();

    if (!tipo) {
      return res.status(400).json({
        ok: false,
        error: "Tipo de solicitud requerido",
        recibido: {
          multipart: esMultipart(req),
          keys: Object.keys(body || {}),
          archivos: Array.isArray(body.archivos) ? body.archivos.length : 0
        }
      });
    }

    /* =====================
       RENDER BOTONES
    ===================== */

    if (tipo === "render-botones") {
      return res.status(200).json({
        ok: true,
        message: "ok render"
      });
    }

    /* =====================
       IMPORTAR EMC
    ===================== */

    if (tipo === "importar-emc") {
      const { analizarImportacionEMC } = await import("../lib/emc-import-engine.js");
      const resultado = await analizarImportacionEMC({ body });
      return res.status(resultado.ok ? 200 : 400).json(resultado);
    }

    /* =====================
       GUARDAR EMC
    ===================== */

    if (tipo === "guardar-emc") {
      const resultado = await manejarGuardarEMC(body, supabase);
      return res.status(resultado.ok ? 200 : 400).json(resultado);
    }

    /* =====================
       OPENAI CHAT FALLBACK
    ===================== */

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY missing"
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: JSON.stringify(body)
        }
      ]
    });

    return res.status(200).json({
      ok: true,
      respuesta: response.output_text
    });
  } catch (error) {
    console.error("CORE ERROR:", error);

    return res.status(500).json({
      ok: false,
      endpoint: "/api/elan-ai",
      error: error.message
    });
  }
}
