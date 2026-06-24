import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

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

function compactarRegistro(registro = {}) {
  const salida = {};

  for (const [key, value] of Object.entries(registro || {})) {
    if (value === null || value === undefined || value === "") continue;

    if (typeof value === "string") {
      salida[key] = value.slice(0, 240);
    } else {
      salida[key] = value;
    }
  }

  return salida;
}

async function leerTablaSegura(nombre, limite = 25) {
  if (!supabase) return { data: [], error: "Supabase no configurado" };

  const { data, error } = await supabase
    .from(nombre)
    .select("*")
    .limit(limite);

  if (error) {
    console.error(`AI-08 error leyendo ${nombre}:`, error.message);
    return { data: [], error: error.message };
  }

  return {
    data: Array.isArray(data) ? data.map(compactarRegistro) : [],
    error: null
  };
}

async function cargarMemoriaOperativaDesdeSupabase({
  entradaUsuario = "",
  unidad = "ELANVISUAL"
} = {}) {
  if (!supabase) {
    return {
      version: "AI-08.1",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: {
        supabase: "no_configurado"
      },
      fuentes: {},
      reglas: [
        "No inventar precios.",
        "No inventar materiales.",
        "No inventar proveedores.",
        "Si no hay dato registrado, indicar pendiente de validacion."
      ]
    };
  }

  const [
    materialesMaster,
    tintasMaster,
    bibliotecaTecnica,
    bibliotecaComponentes,
    tecnologiasImpresion,
    proveedores,
    cotizacionesInteligentes,
    pedidos
  ] = await Promise.all([
    leerTablaSegura("materiales_ia_v2", 40),
    leerTablaSegura("tintas_master", 25),
    leerTablaSegura("biblioteca_tecnica", 25),
    leerTablaSegura("biblioteca_componentes", 35),
    leerTablaSegura("tecnologias_impresion", 25),
    leerTablaSegura("proveedores", 25),
    leerTablaSegura("cotizaciones_inteligentes", 8),
    leerTablaSegura("pedidos", 8)
  ]);

  return {
    version: "AI-08.1",
    unidad,
    entrada_usuario: entradaUsuario,
    estado_fuentes: {
      supabase: "conectado",
      materiales_ia_v2: materialesMaster.error ? "error" : "ok",
      tintas_master: tintasMaster.error ? "error" : "ok",
      biblioteca_tecnica: bibliotecaTecnica.error ? "error" : "ok",
      biblioteca_componentes: bibliotecaComponentes.error ? "error" : "ok",
      tecnologias_impresion: tecnologiasImpresion.error ? "error" : "ok",
      proveedores: proveedores.error ? "error" : "ok",
      cotizaciones_inteligentes: cotizacionesInteligentes.error ? "error" : "ok",
      pedidos: pedidos.error ? "error" : "ok"
    },
    errores_fuentes: {
      materiales_ia_v2: materialesMaster.error,
      tintas_master: tintasMaster.error,
      biblioteca_tecnica: bibliotecaTecnica.error,
      biblioteca_componentes: bibliotecaComponentes.error,
      tecnologias_impresion: tecnologiasImpresion.error,
      proveedores: proveedores.error,
      cotizaciones_inteligentes: cotizacionesInteligentes.error,
      pedidos: pedidos.error
    },
    fuentes: {
      materiales_ia_v2: materialesMaster.data,
      tintas_master: tintasMaster.data,
      biblioteca_tecnica: bibliotecaTecnica.data,
      biblioteca_componentes: bibliotecaComponentes.data,
      tecnologias_impresion: tecnologiasImpresion.data,
      proveedores: proveedores.data,
      cotizaciones_inteligentes: cotizacionesInteligentes.data,
      pedidos: pedidos.data
    },
    reglas: [
      "Primero usar materiales, tintas, biblioteca tecnica, tecnologias y proveedores registrados.",
      "No inventar precios.",
      "No inventar materiales.",
      "No inventar proveedores.",
      "No inventar recetas constructivas.",
      "Si un precio no esta registrado, responder pendiente de validacion.",
      "Si existe precio_m2, precio_unitario, costo, precio, valor, tarifa o unidad registrada, usarlo para calcular.",
      "Si hay datos suficientes, preparar cotizacion preliminar.",
      "Para lonas, viniles o impresion por area: area = ancho x alto.",
      "Para ojetes cada 50 cm: calcular sobre perimetro. Perimetro = (ancho + alto) x 2.",
      "Cantidad de ojetes aproximada = perimetro / separacion.",
      "Si hay precio por metro cuadrado y area, calcular subtotal.",
      "Si hay precio unitario de componente, calcular subtotal por cantidad."
    ]
  };
}

function construirContextoMemoriaOperativa(memoriaOperativa = null) {
  if (!memoriaOperativa || typeof memoriaOperativa !== "object") return "";

  const fuentes = memoriaOperativa.fuentes || {};

  const resumen = {
    version: memoriaOperativa.version || "AI-08.1",
    unidad: memoriaOperativa.unidad || "ELANVISUAL",
    entrada_usuario: memoriaOperativa.entrada_usuario || "",
    estado_fuentes: memoriaOperativa.estado_fuentes || {},
    errores_fuentes: memoriaOperativa.errores_fuentes || {},
    materiales_ia_v2: Array.isArray(fuentes.materiales_ia_v2)
      ? fuentes.materiales_ia_v2.slice(0, 20)
      : [],
    tintas_master: Array.isArray(fuentes.tintas_master)
      ? fuentes.tintas_master.slice(0, 10)
      : [],
    biblioteca_tecnica: Array.isArray(fuentes.biblioteca_tecnica)
      ? fuentes.biblioteca_tecnica.slice(0, 8)
      : [],
    biblioteca_componentes: Array.isArray(fuentes.biblioteca_componentes)
      ? fuentes.biblioteca_componentes.slice(0, 15)
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
CONTEXTO TECNICO OPERATIVO ELANVISUAL / AI-08.1:
Usa este contexto como memoria operativa antes de responder.
No inventes materiales, precios, proveedores, tecnologías ni procesos.
Si un dato no existe en este contexto, marcá: "pendiente de validación".

REGLA CRÍTICA DE COTIZACIÓN:
Si el usuario pide precio, presupuesto o cotización, calculá todo lo posible con los datos disponibles.
Si existe precio_m2, precio_unitario, precio, costo, tarifa o valor en las fuentes, úsalo.
Si no existe precio oficial, indicá pendiente de validación.

REGLAS DE CÁLCULO:
- Área = ancho x alto.
- Perímetro = (ancho + alto) x 2.
- Ojete cada 50 cm = perímetro / 0.50.
- Para lona 2x2 m: área = 4 m².
- Para lona 2x2 m: perímetro = 8 ml.
- Para ojete cada 50 cm: cantidad aproximada = 16 ojetes.
- Si el usuario pide lona impresa, asumir impresión incluida.
- Si el usuario pide instalado, incluir instalación solo si hay tarifa registrada.

FORMATO DE RESPUESTA PARA COTIZACIÓN:
1. Cotización preliminar
2. Medidas y cálculo
3. Material / tecnología usada
4. Despiece preliminar
5. Subtotales si existen precios registrados
6. Total preliminar si hay datos suficientes
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
      version: "AI-08.1"
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

    const unidad = body.unidad || "ELANKAV";
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
      (await cargarMemoriaOperativaDesdeSupabase({
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
      "Si existe precio_m2, precio_unitario, precio, costo, tarifa o valor en memoria operativa, úsalo para calcular.",
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
      respuesta: response.output_text || "",
      clientes,
      debug_estado_fuentes: memoriaOperativa?.estado_fuentes || null,
      debug_errores_fuentes: memoriaOperativa?.errores_fuentes || null
    });
  } catch (error) {
    console.error("Error ELANKAV CORE AI:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Error conectando ELANKAV CORE AI"
    });
  }
}