/* global process */

import { crearClienteSupabase } from "../lib/memoria-operativa.js";
import {
  guardarMemoriaConversacion,
  obtenerMemoriaConversacion,
  normalizarWhatsApp,
} from "../lib/memoria-conversacion.js";

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

const ALLOWED_ORIGINS = new Set([
  "https://visual.elankav.com",
  "https://elankav-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const supabase = crearClienteSupabase();

function cors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://visual.elankav.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

async function handleChat(payload = {}) {
  const apiKey = process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY no configurada en CORE.",
    };
  }

  const mensaje = String(payload.mensaje || payload.message || payload.prompt || "").trim();
  const whatsapp = normalizarWhatsApp(
    payload.whatsapp ||
      payload.WhatsApp ||
      payload.telefono ||
      payload.phone ||
      payload.from ||
      payload.waId ||
      ""
  );

  if (!mensaje) {
    return {
      ok: false,
      error: "Mensaje vacío.",
    };
  }

  const memoria = await obtenerMemoriaConversacion({
    supabase,
    whatsapp,
  });

  const input = [
    {
      role: "system",
      content:
        "Eres ELAN AI, asistente operativo de ELANKAV CORE. Responde de forma clara, comercial y útil. No reveles lógica interna de costos ni fórmulas privadas.",
    },
    ...memoria.contexto,
    {
      role: "user",
      content: mensaje,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ELAN_AI_MODEL || "gpt-4.1-mini",
      input,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || "Error consultando OpenAI.",
      raw: data,
    };
  }

  const respuesta = data.output_text || "";
  const guardadoMemoria = await guardarMemoriaConversacion({
    supabase,
    whatsapp,
    contextoPrevio: memoria.contexto,
    mensajeUsuario: mensaje,
    respuestaAsistente: respuesta,
  });

  return {
    ok: true,
    tipo: "elan-ai-chat",
    respuesta,
    memoria: {
      conversation_id: memoria.conversationId || guardadoMemoria.conversationId || "",
      lectura: memoria.estado,
      escritura: guardadoMemoria.estado,
      persistente: Boolean(memoria.habilitada && guardadoMemoria.ok),
    },
  };
}

export default async function handler(req, res) {
  cors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      endpoint: "/api/elan-ai",
      version: "AI-22 ELAN AI CLEAN",
      status: "ready",
      nota: "Endpoint exclusivo para ELAN AI. EMC vive en /api/emc-import.",
    });
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      ok: false,
      error: "Metodo no permitido.",
    });
  }

  try {
    const payload = req.body || {};
    const tipo = String(payload.tipo || payload.type || "chat").trim();

    if (tipo === "chat" || tipo === "elan-ai" || tipo === "mensaje") {
      const result = await handleChat(payload);
      return send(res, result.ok ? 200 : 400, result);
    }

    return send(res, 400, {
      ok: false,
      error: "Tipo no soportado por /api/elan-ai.",
      tipo,
      tipos_soportados: ["chat", "elan-ai", "mensaje"],
      nota: "EMC ya no se procesa aquí. Usar /api/emc-import.",
    });
  } catch (error) {
    console.error("ERROR /api/elan-ai:", error);

    return send(res, 500, {
      ok: false,
      endpoint: "/api/elan-ai",
      error: error.message || "Error interno en ELAN AI.",
    });
  }
}
