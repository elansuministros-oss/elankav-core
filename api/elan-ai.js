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
  return 0;
}

function construirOrdenTecnicaRenderBotones({ producto, modelo, idea, whatsapp, logoUrl, lugarUrl }) {
  const perfil = obtenerPerfilProducto(producto || "botones");
  const modeloInfo = obtenerModeloBoton(modelo);

  if (!perfil) {
    throw new Error("Perfil de producto no soportado");
  }

  const analisisGrafico = [
    "Analizar el logo o referencia enviada por el cliente.",
    "Respetar nombre, colores dominantes, jerarquía visual y estilo gráfico original.",
    "Adaptar la composición al formato circular sin deformar la identidad.",
    "Mejorar limpieza, márgenes, alineación, legibilidad y balance visual."
  ];

  const materialesRecomendados = [
    "Acrílico transparente o acrílico lechoso según modelo seleccionado.",
    "Vinil impreso de alta resolución, vinil frost o impresión UV según necesidad gráfica.",
    "PVC, acrílico de color o piezas de relieve cortadas en láser cuando aplique.",
    "Separadores metálicos, capatones y sistema de fijación oculto o decorativo."
  ];

  const sistemaConstructivo = [
    `Modelo seleccionado: ${modeloInfo.nombre}.`,
    `Medida base sugerida: ${modeloInfo.medida_base}.`,
    modeloInfo.descripcion,
    "Formato circular 1:1, fabricable en taller, con espesor visible y montaje real.",
    "No convertir en rótulo rectangular ni en producto distinto a botón publicitario."
  ];

  const iluminacion = [
    "Usar luz de rebote suave o iluminación frontal según material y modelo.",
    "La luz debe acompañar la paleta de la marca, no competir con ella.",
    "Dorado: cálida. Azul: blanco frío o azul suave. Verde: verde suave. Multicolor: blanco neutro.",
    "Evitar sobreexposición, halos exagerados o efectos no fabricables."
  ];

  const mejorasSugeridas = [
    "Ajustar proporción del logo para lectura clara a distancia.",
    "Simplificar solo elementos secundarios que afecten fabricación o legibilidad.",
    "Mantener identidad visual principal sin inventar textos, eslóganes ni nueva marca.",
    "Preparar versión limpia para render manual y posterior producción."
  ];

  const instruccionesDisenador = [
    "Crear render manual profesional 1:1 basado en esta orden técnica.",
    "Usar fondo sobrio, pared limpia o contexto comercial realista.",
    "Mostrar volumen físico, canto, sombras suaves, reflejos controlados y escala real.",
    "No mostrar procesos internos, costos, fórmulas ni materiales sensibles al cliente.",
    "Preparar propuesta para envío por WhatsApp al cliente."
  ];

  const observaciones = [
    logoUrl ? `Logo o referencia recibida: ${logoUrl}` : "No se recibió logo confirmado.",
    lugarUrl ? `Foto del lugar recibida: ${lugarUrl}` : "No se recibió foto del lugar.",
    idea ? `Idea del cliente: ${idea}` : "El cliente solicita una propuesta profesional personalizada.",
    `WhatsApp del cliente: ${whatsapp}`
  ];

  return {
    producto: perfil.producto,
    especialista: perfil.especialista,
    modelo,
    modelo_nombre: modeloInfo.nombre,
    precio_referencia: modeloInfo.precio,
    medida_base: modeloInfo.medida_base,
    analisis_grafico: analisisGrafico,
    materiales_recomendados: materialesRecomendados,
    sistema_constructivo: sistemaConstructivo,
    iluminacion,
    mejoras_sugeridas: mejorasSugeridas,
    instrucciones_disenador: instruccionesDisenador,
    observaciones
  };
}

const ORDEN_MAESTRA_RENDER_BOTONES = `
ELAN AI DESIGNER opera ahora como Director de Arte Técnico.
No genera imágenes.
No usa image_generation.
No devuelve render.
Debe crear una Orden Técnica para diseño manual profesional.
`;

async function manejarRenderBotones(body = {}) {
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
  const referenciaUrl = String(body.referencia_url || "").trim();
const lugarUrl = String(body.lugar_url || body.foto_lugar || body.foto || "").trim();

  if (!whatsapp) {
    return {
      status: 400,
      payload: { ok: false, error: "Falta WhatsApp" }
    };
  }

  const ordenTecnica = construirOrdenTecnicaRenderBotones({
    producto,
    modelo,
    idea,
    whatsapp,
    logoUrl,
    lugarUrl
  });

  const solicitud = {
    unidad: "ELANVISUAL",
    tipo: "solicitud_render_manual",
    producto,
    modelo,
    whatsapp,
    negocio: body.negocio || null,

    idea,

    logo_nombre: body.logo_nombre || null,
    logo_url: logoUrl || null,

    referencia_nombre: body.referencia_nombre || null,
    referencia_url: referenciaUrl || null,

    lugar_nombre: body.lugar_nombre || null,
    lugar_url: lugarUrl || null,
    orden_tecnica: ordenTecnica,
    estado: "pendiente_diseno_manual",
    origen: "ELAN AI DESIGNER",
    creado_en: new Date().toISOString()
  };

  const { data: insertado, error: insertError } = await supabase
    .from("elan_ai_solicitudes_render")
    .insert(solicitud)
    .select("id")
    .single();

  if (insertError) {
    console.error("Error guardando solicitud manual:", insertError);
    return {
      status: 500,
      payload: {
        ok: false,
        estado: "error_guardando_solicitud",
        error: insertError.message
      }
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      tipo: "render-botones",
      estado: "pendiente_diseno_manual",
      id_solicitud: insertado?.id || null,
      mensaje: "Tu solicitud fue enviada correctamente. Nuestro equipo de diseño preparará una propuesta personalizada y la recibirás por WhatsApp."
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




