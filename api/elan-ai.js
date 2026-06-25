import OpenAI from "openai";
import {
  crearClienteSupabase,
  obtenerMemoriaOperativa
} from "../lib/memoria-operativa.js";

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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

function filtrarMaterialesRelevantes(materiales = [], texto = "") {
  const t = String(texto || "").toLowerCase();

  const palabras = [];

  if (t.includes("lona") || t.includes("banner")) palabras.push("lona", "banner");
  if (t.includes("traslucida") || t.includes("traslúcida")) palabras.push("traslucida", "traslúcida");
  if (t.includes("mesh")) palabras.push("mesh");
  if (t.includes("vinil")) palabras.push("vinil");
  if (t.includes("micro")) palabras.push("microperforado");
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
    Array.isArray(fuentes.materiales_master_v2)
      ? fuentes.materiales_master_v2
      : [],
    entrada
  );

  const materialesIA = filtrarMaterialesRelevantes(
    Array.isArray(fuentes.materiales_ia_v2) ? fuentes.materiales_ia_v2 : [],
    entrada
  );

  const resumen = {
    version: memoriaOperativa.version || "AI-09.1",
    unidad: memoriaOperativa.unidad || "ELANVISUAL",
    entrada_usuario: entrada,
    estado_fuentes: memoriaOperativa.estado_fuentes || {},
    errores_fuentes: memoriaOperativa.errores_fuentes || {},
    fuente_principal_precios: "materiales_master_v2",
    materiales_master_v2: materialesMaster,
    materiales_ia_v2_auxiliar: materialesIA.slice(0, 10),
    tintas_master: Array.isArray(fuentes.tintas_master)
      ? fuentes.tintas_master.slice(0, 10)
      : [],
    biblioteca_tecnica: Array.isArray(fuentes.biblioteca_tecnica)
      ? fuentes.biblioteca_tecnica.slice(0, 8)
      : [],
    biblioteca_componentes: Array.isArray(fuentes.biblioteca_componentes)
      ? fuentes.biblioteca_componentes.slice(0, 20)
      : [],
    tecnologias_impresion: Array.isArray(fuentes.tecnologias_impresion)
      ? fuentes.tecnologias_impresion.slice(0, 8)
      : [],
    proveedores: Array.isArray(fuentes.proveedores)
      ? fuentes.proveedores.slice(0, 8)
      : [],
    reglas: memoriaOperativa.reglas || []
  };

  return `
CONTEXTO TECNICO OPERATIVO ELANVISUAL / AI-09.1:

Usa este contexto como memoria operativa antes de responder.
No inventes materiales, precios, proveedores, tecnologías ni procesos.
Si un dato no existe en este contexto, marcá: "pendiente de validación".

REGLA CRÍTICA:
La fuente principal de precios es materiales_master_v2.
No uses materiales_ia_v2 para precios si materiales_master_v2 tiene datos.

CAMPOS DE PRECIO DISPONIBLES:
- precio_venta_1x: precio comercial base por m².
- precio_venta_1_5x: precio comercial medio por m².
- precio_venta_2x: precio comercial premium por m².
- costo_m2_material: costo material por m².
- costo_con_tinta: costo material + tinta por m².
- tinta_m2: costo tinta por m² si existe.

REGLAS DE CÁLCULO:
- Área = ancho x alto.
- Perímetro = (ancho + alto) x 2.
- Ojete cada 50 cm = perímetro / 0.50.
- Para lona 2x2 m: área = 4 m².
- Para lona 2x2 m: perímetro = 8 ml.
- Para ojete cada 50 cm: cantidad aproximada = 16 ojetes.
- Si el usuario pide lona impresa, usar material tipo lona banner y tecnología ecosolvente salvo mejor dato registrado.
- Si hay precio_venta_1x y área, calcular subtotal comercial.
- Si no hay precio de ojete registrado, indicarlo como pendiente de validación sin bloquear la cotización.

FORMATO DE RESPUESTA PARA COTIZACIÓN:
1. Cotización preliminar
2. Medidas y cálculo
3. Material / tecnología usada
4. Despiece preliminar
5. Subtotales con precios registrados
6. Total preliminar
7. Pendientes de validación
8. Siguiente acción recomendada

${JSON.stringify(resumen, null, 2)}
`;
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
    return res.status(200).json({
      ok: true,
      message: "CORS OK"
    });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "ELANKAV CORE AI",
      endpoint: "/api/elan-ai",
      status: "online",
      version: "AI-09.1"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido"
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY no configurada"
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const body = req.body || {};

    const unidad = body.unidad || "ELANVISUAL";
    const contexto = body.contexto || "";
    const proyecto = body.proyecto || null;
    const usuario = body.usuario || null;
    const modo = body.modo || "chat";

    const mensajes = normalizarMensajes(body);
    const memoriaOperativaBase = body.memoria_operativa || null;

    if (!mensajes.length) {
      return res.status(400).json({
        ok: false,
        error: "Falta mensaje"
      });
    }

    const textoUsuario = ultimoTextoUsuario(mensajes);

    const memoriaOperativa =
      memoriaOperativaBase ||
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
      "Extrae automáticamente toda la información posible del mensaje del usuario.",
      "No hagas preguntas sobre información que ya fue proporcionada.",
      "Máximo una pregunta por respuesta.",
      "Si identificas producto y medidas debes avanzar inmediatamente hacia una cotización preliminar.",
      "Si el usuario pide cotización, presupuesto o precio, activa automáticamente MODO COTIZADOR.",
      "Primero cotiza. Después completa detalles si son necesarios.",
      "No bloquees una cotización por falta de CRM.",
      "No obligues a registrar clientes para cotizar.",
      "No preguntes si desea PDF antes de generar la cotización.",
      "No preguntes por IVA salvo que sea necesario.",
      "No preguntes por instalación si el usuario escribió instalado.",
      "No preguntes por impresión si el usuario escribió full color.",
      "No preguntes por laminado si el usuario escribió sobre laminado.",
      "Solo pregunta cuando falten datos imposibles de deducir.",
      "Interpreta automáticamente:",
      "'full color' = impresión full color.",
      "'vinil adhesivo impreso' = impresión incluida.",
      "'lona impresa' = lona con impresión incluida.",
      "'sobre laminado' = laminado incluido.",
      "'instalado' = instalación incluida.",
      "'sin instalación' = instalación no incluida.",
      "'fachada existente' = estructura existente.",
      "Usa la memoria operativa de Supabase antes de responder.",
      "La fuente principal de precios es materiales_master_v2.",
      "materiales_ia_v2 es solo auxiliar de búsqueda, no fuente principal de precios.",
      "Si existe precio_venta_1x, precio_venta_1_5x, precio_venta_2x, costo_m2_material o costo_con_tinta en memoria operativa, úsalo.",
      "Para cotización comercial preliminar usa preferentemente precio_venta_1x.",
      "Para lonas, viniles o impresión por área: área = ancho x alto.",
      "Para ojetes cada 50 cm: calcular sobre perímetro. Perímetro = (ancho + alto) x 2.",
      "Cantidad de ojetes aproximada = perímetro / separación.",
      "Si hay precio por m² y área, calcular subtotal.",
      "Si hay precio unitario de componente, calcular subtotal por cantidad.",
      "Si no existe un precio oficial disponible, genera una propuesta preliminar estructurada sin inventar costos.",
      "Responde de forma breve, comercial, directa y útil para vendedores.",
      `Unidad: ${unidad}`,
      `Modo: ${modo}`,
      proyecto ? `Proyecto:\n${JSON.stringify(proyecto)}` : "",
      usuario ? `Usuario:\n${JSON.stringify(usuario)}` : "",
      contexto ? `Contexto:\n${contexto}` : "",
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
        {
          role: "developer",
          content: construirContextoMemoriaOperativa(memoriaOperativa)
        },
        ...mensajes
      ]
    });

    return res.status(200).json({
      ok: true,
      version: "AI-09.1",
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
