import OpenAI from "openai";
import {
  crearClienteSupabase,
  obtenerMemoriaOperativa
} from "../lib/memoria-operativa.js";
import {
  obtenerPerfilProducto,
  obtenerModeloBoton
} from "../lib/aiProductProfiles.js";

const supabase = crearClienteSupabase();

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

function normalizarTelefono(valor = "") {
  return String(valor || "").replace(/[^\d+]/g, "").trim();
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
  return String([...mensajes].reverse().find((m) => m.role === "user")?.content || "").trim();
}

function contextoClientes(clientes = []) {
  if (!clientes.length) return "Clientes CRM encontrados: ninguno.";
  return [
    "Clientes CRM encontrados:",
    ...clientes.map((c, i) => {
      const nombre = c.empresa || c.cliente || c.nombre || c.contacto || "Sin nombre";
      return `${i + 1}. ${nombre} | ${c.whatsapp || c.telefono || ""} | ${c.ciudad || ""}`;
    })
  ].join("\n");
}

function filtrarMaterialesRelevantes(materiales = [], texto = "") {
  const t = String(texto || "").toLowerCase();
  const palabras = [];

  if (t.includes("lona") || t.includes("banner")) palabras.push("lona", "banner");
  if (t.includes("vinil")) palabras.push("vinil");
  if (t.includes("pvc")) palabras.push("pvc");
  if (t.includes("acrilico") || t.includes("acrílico")) palabras.push("acrilico", "acrílico");
  if (t.includes("acm")) palabras.push("acm");

  if (!palabras.length) return materiales.slice(0, 20);

  return materiales
    .filter((m) => {
      const nombre = String(m.nombre || "").toLowerCase();
      const categoria = String(m.categoria || "").toLowerCase();
      return palabras.some((p) => nombre.includes(p) || categoria.includes(p));
    })
    .slice(0, 20);
}

function construirContextoMemoriaOperativa(memoriaOperativa = null) {
  if (!memoriaOperativa || typeof memoriaOperativa !== "object") return "";

  const fuentes = memoriaOperativa.fuentes || {};
  const entrada = memoriaOperativa.entrada_usuario || "";

  const materialesMaster = filtrarMaterialesRelevantes(
    Array.isArray(fuentes.materiales_master_v2) ? fuentes.materiales_master_v2 : [],
    entrada
  );

  return `
CONTEXTO TECNICO OPERATIVO ELANVISUAL:
- Fuente principal de precios: materiales_master_v2.
- No inventar precios, materiales, proveedores ni procesos.
- No mostrar costos internos, fórmulas, tintas, márgenes ni despiece al cliente.
- Si falta dato crítico, hacer máximo una pregunta.

MATERIALES RELEVANTES:
${JSON.stringify(materialesMaster, null, 2)}
`;
}

async function contarUsosRender({ whatsapp }) {
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("elan_ai_renders")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp", whatsapp)
    .eq("producto", "botones");

  if (error) {
    console.error("Error contando usos:", error);
    return 0;
  }

  return count || 0;
}

function construirPromptRenderBotones({ producto, modelo, idea, whatsapp, logoUrl, lugarUrl }) {
  const perfil = obtenerPerfilProducto(producto || "botones");
  const modeloInfo = obtenerModeloBoton(modelo);

  if (!perfil) {
    throw new Error("Perfil de producto no soportado");
  }

  return `
Crear un render comercial realista para ELANVISUAL.

Especialista: ${perfil.especialista}
Producto: ${perfil.producto}
Modelo seleccionado: ${modeloInfo.nombre}
Referencia visual interna: ${modeloInfo.referencia}
Precio comercial del modelo: ${modeloInfo.precio}
Medida base: ${modeloInfo.medida_base}
Descripción técnica: ${modeloInfo.descripcion}

Idea del cliente:
${idea || "El cliente desea una propuesta profesional para su marca."}

WhatsApp del cliente:
${whatsapp}

Logo enviado:
${logoUrl ? `Sí. Referencia: ${logoUrl}` : "No confirmado."}

Foto del lugar:
${lugarUrl ? `Sí. Referencia: ${lugarUrl}` : "No enviada."}

Reglas obligatorias:
${perfil.reglas.map((r) => `- ${r}`).join("\n")}

Dirección visual:
- Render cuadrado 1024x1024.
- Producto circular real, proporción 1:1.
- Botón publicitario premium montado en pared limpia o contexto comercial sobrio.
- Acabados realistas: acrílico, impresión, brillo controlado y volumen físico.
- Iluminación profesional sin exagerar.
- Nada de rótulos rectangulares.
- Nada de productos ajenos a botones.
- No agregar textos inventados fuera del logo o idea de marca.
- Resultado vendible, elegante, moderno y fabricable.
`;
}

async function manejarRenderBotones(body = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: 500,
      payload: { ok: false, error: "OPENAI_API_KEY no configurada en CORE" }
    };
  }

  if (!supabase) {
    return {
      status: 500,
      payload: { ok: false, error: "Supabase no configurado en CORE" }
    };
  }

  const whatsapp = normalizarTelefono(body.whatsapp || body.WhatsApp || body.telefono || "");
  const producto = String(body.producto || "botones").trim();
  const modelo = String(body.modelo || "boton-transparente").trim();
  const idea = String(body.idea || body.prompt || body.mensaje || "").trim();
  const logoUrl = String(body.logo_url || body.logo || "").trim();
  const lugarUrl = String(body.lugar_url || body.foto_lugar || body.foto || "").trim();

  if (!whatsapp) {
    return {
      status: 400,
      payload: { ok: false, error: "Falta WhatsApp" }
    };
  }

  const usosActuales = await contarUsosRender({ whatsapp });

  if (usosActuales >= 3) {
    return {
      status: 200,
      payload: {
        ok: false,
        limite_alcanzado: true,
        usos_restantes: 0,
        mensaje: "No es posible generar más propuestas automáticas. Nuestro equipo realizará la digitalización profesional de su proyecto."
      }
    };
  }

  const promptUtilizado = construirPromptRenderBotones({
    producto,
    modelo,
    idea,
    whatsapp,
    logoUrl,
    lugarUrl
  });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: process.env.OPENAI_RENDER_MODEL || "gpt-5.5",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: promptUtilizado },
          ...(logoUrl ? [{ type: "input_image", image_url: logoUrl }] : []),
          ...(lugarUrl ? [{ type: "input_image", image_url: lugarUrl }] : [])
        ]
      }
    ],
    tools: [{ type: "image_generation" }]
  });

  const imagenBase64 = response.output
    ?.filter((item) => item.type === "image_generation_call")
    ?.map((item) => item.result)
    ?.find(Boolean);

  if (!imagenBase64) {
    throw new Error("OpenAI no devolvió imagen generada");
  }

  const imagen = `data:image/png;base64,${imagenBase64}`;
  const usosNumero = usosActuales + 1;

  const { data: insertado, error: insertError } = await supabase
    .from("elan_ai_renders")
    .insert({
      unidad: "ELANVISUAL",
      producto: "botones",
      modelo,
      whatsapp,
      idea,
      prompt_utilizado: promptUtilizado,
      logo_url: logoUrl || null,
      lugar_url: lugarUrl || null,
      render_url: imagen,
      estado: "generado",
      usos_numero: usosNumero
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error guardando render:", insertError);
    throw new Error(`No se pudo guardar render en Supabase: ${insertError.message}`);
  }

  return {
    status: 200,
    payload: {
      ok: true,
      tipo: "render-botones",
      imagen,
      prompt_utilizado: promptUtilizado,
      usos_restantes: Math.max(0, 3 - usosNumero),
      id_lead: insertado?.id || null
    }
  };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true, message: "CORS OK" });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "ELANKAV CORE AI",
      endpoint: "/api/elan-ai",
      status: "online",
      version: "AI-10-DESIGNER",
      soporta: ["chat", "render-botones"]
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const body = req.body || {};
    const tipo = String(body.tipo || "").trim();

    if (tipo === "render-botones") {
      const resultado = await manejarRenderBotones(body);
      return res.status(resultado.status).json(resultado.payload);
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY no configurada" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const unidad = body.unidad || "ELANVISUAL";
    const contexto = body.contexto || "";
    const proyecto = body.proyecto || null;
    const usuario = body.usuario || null;
    const modo = body.modo || "chat";
    const mensajes = normalizarMensajes(body);

    if (!mensajes.length) {
      return res.status(400).json({ ok: false, error: "Falta mensaje" });
    }

    const textoUsuario = ultimoTextoUsuario(mensajes);
    const memoriaOperativa =
      body.memoria_operativa ||
      (await obtenerMemoriaOperativa({
        supabase,
        entradaUsuario: textoUsuario,
        unidad
      }));

    const clientes = [];

    const system = [
      "Eres ELANKAV CORE AI.",
      "Para ELANVISUAL trabajas como asesor comercial senior y técnico de rotulación.",
      "Tu prioridad es responder, resolver y cotizar, no entrevistar.",
      "No inventes materiales, precios, proveedores ni tecnologías.",
      "Usa la memoria operativa de Supabase antes de responder.",
      "Máximo una pregunta por respuesta.",
      "No reveles costos internos, fórmulas, márgenes, tintas ni despieces.",
      "Responde breve, comercial, directo y útil.",
      `Unidad: ${unidad}`,
      `Modo: ${modo}`,
      proyecto ? `Proyecto:\n${JSON.stringify(proyecto)}` : "",
      usuario ? `Usuario:\n${JSON.stringify(usuario)}` : "",
      contexto ? `Contexto:\n${contexto}` : "",
      contextoClientes(clientes)
    ].filter(Boolean).join("\n");

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "developer", content: construirContextoMemoriaOperativa(memoriaOperativa) },
        ...mensajes
      ]
    });

    return res.status(200).json({
      ok: true,
      version: "AI-10-DESIGNER",
      respuesta: response.output_text || "",
      clientes,
      debug_estado_fuentes: memoriaOperativa?.estado_fuentes || null,
      debug_errores_fuentes: memoriaOperativa?.errores_fuentes || null
    });
  } catch (error) {
    console.error("Error ELANKAV CORE AI:", error);

    return res.status(500).json({
      ok: false,
      endpoint: "/api/elan-ai",
      error: error?.message || "Error conectando ELANKAV CORE AI"
    });
  }
}
