```js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

const allowedOrigins = [
  "https://visual.elankav.com",
  "https://elanvisual-platform.vercel.app",
  "http://localhost:5173"
];

function setCors(req, res) {
  const origin = req.headers.origin || "";

  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://visual.elankav.com";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
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

function ultimoTextoUsuario(mensajes = []) {
  const ultimos = [...mensajes].reverse();

  return String(
    ultimos.find((m) => m.role === "user")?.content || ""
  ).trim();
}

function limpiarBusqueda(valor = "") {
  return String(valor)
    .trim()
    .replace(/[^\p{L}\p{N}\s@.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function buscarClientes(texto = "", usuario = {}) {
  if (!supabase) return [];

  const q = limpiarBusqueda(texto);

  if (!q || q.length < 2) return [];

  const like = `%${q}%`;

  let query = supabase
    .from("clientes")
    .select(
      `
      id,
      cliente,
      empresa,
      nombre,
      contacto,
      whatsapp,
      telefono,
      correo,
      email,
      ruc,
      ciudad,
      vendedor_id,
      vendedor_nombre
    `
    )
    .or(
      [
        `cliente.ilike.${like}`,
        `empresa.ilike.${like}`,
        `nombre.ilike.${like}`,
        `contacto.ilike.${like}`,
        `whatsapp.ilike.${like}`,
        `telefono.ilike.${like}`,
        `correo.ilike.${like}`,
        `email.ilike.${like}`,
        `ruc.ilike.${like}`,
        `ciudad.ilike.${like}`
      ].join(",")
    )
    .limit(8);

  if (usuario?.rol === "ventas" && usuario?.id) {
    query = query.or(
      `vendedor_id.eq.${usuario.id},vendedor_id.is.null`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error buscando clientes:", error);
    return [];
  }

  return data || [];
}

function contextoClientes(clientes = []) {
  if (!clientes.length) {
    return "Clientes CRM encontrados: ninguno.";
  }

  return [
    "Clientes CRM encontrados:",
    ...clientes.map((c, i) => {
      const nombre =
        c.empresa ||
        c.cliente ||
        c.nombre ||
        c.contacto ||
        "Sin nombre";

      return `${i + 1}. ${nombre} | ${
        c.whatsapp || c.telefono || ""
      } | ${c.ciudad || ""}`;
    })
  ].join("\n");
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

    const textoUsuario = ultimoTextoUsuario(mensajes);

    const clientes =
      unidad === "ELANVISUAL"
        ? await buscarClientes(textoUsuario, usuario)
        : [];

    const system = [
      "Eres ELANKAV CORE AI.",

      "Para ELANVISUAL trabajas como asesor comercial senior.",

      "Tu prioridad es responder, resolver y cotizar, no entrevistar.",

      "Extrae automáticamente toda la información posible del mensaje del usuario.",

      "No hagas preguntas sobre información que ya fue proporcionada.",

      "Máximo una pregunta por respuesta.",

      "Si identificas producto, medidas y ciudad debes avanzar inmediatamente hacia una cotización preliminar.",

      "Si el usuario pide cotización, presupuesto o precio, activa automáticamente MODO COTIZADOR.",

      "Primero cotiza. Después completa detalles si son necesarios.",

      "No bloquees una cotización por falta de CRM.",

      "No obligues a registrar clientes para cotizar.",

      "Si existe coincidencia CRM puedes mencionarla, pero no detengas la cotización.",

      "No preguntes si desea PDF antes de generar la cotización.",

      "No preguntes por IVA salvo que sea necesario.",

      "No preguntes por instalación si el usuario escribió instalado.",

      "No preguntes por impresión si el usuario escribió full color.",

      "No preguntes por laminado si el usuario escribió sobre laminado.",

      "Solo pregunta cuando falten datos imposibles de deducir.",

      "Interpreta automáticamente:",

      "'full color' = impresión full color.",

      "'vinil adhesivo impreso' = impresión incluida.",

      "'sobre laminado' = laminado incluido.",

      "'instalado' = instalación incluida.",

      "'sin instalación' = instalación no incluida.",

      "'fachada existente' = estructura existente.",

      "Utiliza información del CRM, proyecto y contexto cuando exista.",

      "Si no existe un precio oficial disponible, genera una propuesta preliminar estructurada sin inventar costos.",

      "Responde de forma breve, comercial, directa y útil para vendedores.",

      `Unidad: ${unidad}`,
      `Modo: ${modo}`,

      proyecto
        ? `Proyecto:\n${JSON.stringify(proyecto)}`
        : "",

      usuario
        ? `Usuario:\n${JSON.stringify(usuario)}`
        : "",

      contexto
        ? `Contexto:\n${contexto}`
        : "",

      contextoClientes(clientes)
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
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
      respuesta: response.output_text || "",
      clientes
    });
  } catch (error) {
    console.error("Error ELANKAV CORE AI:", error);

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Error conectando ELANKAV CORE AI"
    });
  }
}
```
