import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
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
    return [{ role: "user", content: String(body.mensaje) }];
  }

  return [];
}

function ultimoTextoUsuario(mensajes = []) {
  const ultimos = [...mensajes].reverse();
  return String(ultimos.find((m) => m.role === "user")?.content || "").trim();
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
      "id, cliente, empresa, nombre, contacto, whatsapp, telefono, correo, email, ruc, ciudad, vendedor_id, vendedor_nombre"
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
    query = query.or(`vendedor_id.eq.${usuario.id},vendedor_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error buscando clientes:", error);
    return [];
  }

  return data || [];
}

function contextoClientes(clientes = []) {
  if (!clientes.length) return "Clientes encontrados en CRM: ninguno.";

  return [
    "Clientes encontrados en CRM ELANVISUAL:",
    ...clientes.map((c, i) => {
      const nombre = c.empresa || c.cliente || c.nombre || c.contacto || "Sin nombre";
      const contacto = c.contacto || c.nombre || "";
      const telefono = c.whatsapp || c.telefono || "";
      const correo = c.correo || c.email || "";
      const ciudad = c.ciudad || "";
      return `${i + 1}. ID: ${c.id} | Cliente: ${nombre} | Contacto: ${contacto} | Tel: ${telefono} | Correo: ${correo} | Ciudad: ${ciudad} | Vendedor: ${c.vendedor_nombre || c.vendedor_id || "Sin asignar"}`;
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
    const clientes = unidad === "ELANVISUAL" ? await buscarClientes(textoUsuario, usuario) : [];

    const system = [
      "Eres ELANKAV CORE AI, asistente central para ELANVISUAL, ELANPET, ELANCENTER, ELANHOME y ELAN AI.",
      "Ayudas a crear propuestas, análisis técnicos, recomendaciones, respuestas rápidas y organización operativa.",
      "No inventes precios. Si falta precio, indica solicitud de costo. No modifiques precios oficiales.",
      "No menciones materiales, tecnologías, proveedores o acabados que no estén explícitamente en el mensaje, contexto, proyecto o base técnica entregada.",
      "Si el material no está confirmado, pregunta por el material sin sugerir nombres externos.",
      "Para ELANVISUAL, no uses ejemplos genéricos como mesh, frontlit, backlit, canvas u otros si no vienen en la base técnica.",
      "Cuando falten datos, pregunta solo lo necesario: medida, cantidad, impresión, instalación, ciudad y fecha requerida.",
      "Si se encuentran clientes CRM, preséntalos primero y pregunta cuál desea usar antes de cotizar.",
      "No inventes clientes. Si no aparece en CRM, indica que no encontraste coincidencia y pregunta si desea registrarlo.",
      `Unidad: ${unidad}`,
      `Modo: ${modo}`,
      proyecto ? `Proyecto: ${JSON.stringify(proyecto)}` : "",
      usuario ? `Usuario: ${JSON.stringify(usuario)}` : "",
      contexto ? `Contexto: ${contexto}` : "",
      contextoClientes(clientes)
    ].filter(Boolean).join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
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
      error: error?.message || "Error conectando ELANKAV CORE AI"
    });
  }
}