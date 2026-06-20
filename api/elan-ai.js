import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const allowedOrigins = [
  "https://visual.elankav.com",
  "https://elanvisual-platform.vercel.app",
  "http://localhost:5173"
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : "https://visual.elankav.com";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function normalizarMensajes(body = {}) {
  if (Array.isArray(body.messages) && body.messages.length) {
    return body.messages
      .filter((m) => m?.content)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      }));
  }

  if (body.mensaje) {
    return [
      {
        role: "user",
        content: String(body.mensaje)
      }
    ];
  }

  return [];
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido"
    });
  }

  try {
    const body = req.body || {};
    const unidad = body.unidad || "ELANKAV";
    const contexto = body.contexto || "";
    const proyecto = body.proyecto || null;
    const usuario = body.usuario || null;
    const modo = body.modo || "chat";
    const mensajes = normalizarMensajes(body);

    if (!mensajes.length) {
      return res.status(400).json({
        ok: false,
        error: "Falta mensaje"
      });
    }

    const system = [
      "Eres ELANKAV CORE AI, asistente central para ELANVISUAL, ELANPET, ELANCENTER, ELANHOME y ELAN AI.",
      "Ayudas a crear propuestas, análisis técnicos, recomendaciones, respuestas rápidas y organización operativa.",
      "No inventes precios. Si falta precio, indica solicitud de costo. No modifiques precios oficiales.",
      `Unidad: ${unidad}`,
      `Modo: ${modo}`,
      proyecto ? `Proyecto: ${JSON.stringify(proyecto)}` : "",
      usuario ? `Usuario: ${JSON.stringify(usuario)}` : "",
      contexto ? `Contexto: ${contexto}` : ""
    ].filter(Boolean).join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: system
        },
        ...mensajes
      ]
    });

    return res.status(200).json({
      ok: true,
      respuesta: response.output_text || ""
    });
  } catch (error) {
    console.error("Error ELANKAV CORE AI:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error conectando ELANKAV CORE AI"
    });
  }
}