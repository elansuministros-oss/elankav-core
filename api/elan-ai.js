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



async function leerTablaSegura(nombre, limite = 25) {
  if (!supabase) return { data: [], error: "Supabase no configurado" };

  const { data, error } = await supabase
    .from(nombre)
    .select(
      nombre === "cotizaciones_inteligentes" || nombre === "pedidos"
        ? "id,estado,created_at"
        : "id,nombre,estado"
    )
    .limit(limite);

  if (error) {
    console.error(`AI-07 error leyendo ${nombre}:`, error.message);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

async function cargarMemoriaOperativaDesdeSupabase({ entradaUsuario = "", unidad = "ELANVISUAL" } = {}) {
  if (!supabase) {
    return {
      version: "AI-07",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: {
        supabase: "no_configurado",
      },
      fuentes: {},
      reglas: [
        "No inventar precios.",
        "No inventar materiales.",
        "No inventar proveedores.",
        "Si no hay dato registrado, indicar pendiente de validacion.",
      ],
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
    pedidos,
  ] = await Promise.all([
    leerTablaSegura("materiales_master", 40),
    leerTablaSegura("tintas_master", 30),
    leerTablaSegura("biblioteca_tecnica", 30),
    leerTablaSegura("biblioteca_componentes", 40),
    leerTablaSegura("tecnologias_impresion", 30),
    leerTablaSegura("proveedores", 30),
    leerTablaSegura("cotizaciones_inteligentes", 15),
    leerTablaSegura("pedidos", 15),
  ]);

  return {
    version: "AI-07",
    unidad,
    entrada_usuario: entradaUsuario,
    estado_fuentes: {
      supabase: "conectado",
      materiales_master: materialesMaster.error ? "error" : "ok",
      tintas_master: tintasMaster.error ? "error" : "ok",
      biblioteca_tecnica: bibliotecaTecnica.error ? "error" : "ok",
      biblioteca_componentes: bibliotecaComponentes.error ? "error" : "ok",
      tecnologias_impresion: tecnologiasImpresion.error ? "error" : "ok",
      proveedores: proveedores.error ? "error" : "ok",
      cotizaciones_inteligentes: cotizacionesInteligentes.error ? "error" : "ok",
      pedidos: pedidos.error ? "error" : "ok",
    },
    fuentes: {
      materiales_master: materialesMaster.data,
      tintas_master: tintasMaster.data,
      biblioteca_tecnica: bibliotecaTecnica.data,
      biblioteca_componentes: bibliotecaComponentes.data,
      tecnologias_impresion: tecnologiasImpresion.data,
      proveedores: proveedores.data,
      cotizaciones_inteligentes: cotizacionesInteligentes.data,
      pedidos: pedidos.data,
    },
    reglas: [
      "Primero usar materiales, tintas, biblioteca tecnica, tecnologias y proveedores registrados.",
      "No inventar precios.",
      "No inventar materiales.",
      "No inventar proveedores.",
      "No inventar recetas constructivas.",
      "Si un precio no esta registrado, responder pendiente de validacion.",
      "Si hay datos suficientes, preparar cotizacion preliminar sin crear precio falso.",
    ],
  };
}
function construirContextoMemoriaOperativa(memoriaOperativa = null) {
  if (!memoriaOperativa || typeof memoriaOperativa !== "object") return "";

  const fuentes = memoriaOperativa.fuentes || {};
  const produccion = memoriaOperativa.produccion_preliminar || {};
  const estadoFuentes = memoriaOperativa.estado_fuentes || {};

  const resumen = {
    version: memoriaOperativa.version || "AI-05",
    unidad: memoriaOperativa.unidad || "ELANVISUAL",
    proyecto: memoriaOperativa.proyecto || null,
    entrada_usuario: memoriaOperativa.entrada_usuario || "",
    estado_fuentes: estadoFuentes,
    materiales_master: Array.isArray(fuentes.materiales_master) ? fuentes.materiales_master.slice(0, 8) : [],
    tintas_master: Array.isArray(fuentes.tintas_master) ? fuentes.tintas_master.slice(0, 5) : [],
    biblioteca_tecnica: Array.isArray(fuentes.biblioteca_tecnica) ? fuentes.biblioteca_tecnica.slice(0, 5) : [],
    biblioteca_componentes: Array.isArray(fuentes.biblioteca_componentes) ? fuentes.biblioteca_componentes.slice(0, 8) : [],
    tecnologias_impresion: Array.isArray(fuentes.tecnologias_impresion) ? fuentes.tecnologias_impresion.slice(0, 6) : [],
    proveedores: Array.isArray(fuentes.proveedores) ? fuentes.proveedores.slice(0, 5) : [],
    cotizaciones_inteligentes: Array.isArray(fuentes.cotizaciones_inteligentes) ? fuentes.cotizaciones_inteligentes.slice(0, 3) : [],
    pedidos: Array.isArray(fuentes.pedidos) ? fuentes.pedidos.slice(0, 3) : [],
    produccion_preliminar: produccion,
    reglas: memoriaOperativa.reglas || [],
  };

  return `
CONTEXTO TECNICO OPERATIVO ELANVISUAL / AI-05:
Usa este contexto como memoria operativa antes de responder.
No inventes materiales, precios, proveedores, tecnologías ni procesos.
Si un dato no existe en este contexto, marcá: "pendiente de validación".
El despiece y producción son preliminares hasta validación técnica.

AI-06 CONSULTA TECNICA AUTOMATICA:
Cuando la memoria incluya ai06_consulta_tecnica, respondé como asesor técnico operativo.
Primero usá los registros relevantes detectados.
Estructurá la respuesta así:
1. Diagnóstico técnico
2. Solución recomendada
3. Materiales reales disponibles
4. Tecnología de producción
5. Proveedor sugerido si existe
6. Despiece preliminar
7. Datos faltantes o pendientes de validación
8. Siguiente acción recomendada

AI-06B REGLAS COMERCIALES:
Usá ai06b_reglas_comerciales para decidir si preguntás o avanzás.

Modos de precio:
- fijo: NO preguntar tinta; usar receta/precio predefinido si existe.
- configurable: si requiere_preguntar_tinta es true, preguntar tinta/tecnología antes de mandar al cotizador.
- tecnico: preguntar solo datos indispensables de fabricación, instalación o medida.
- general: responder como consulta rápida.

Estados comerciales:
- consulta_rapida: responder precio o análisis preliminar; NO crear cotización.
- cotizacion_en_preparacion: validar datos obligatorios y preparar envío al cotizador.
- cotizacion_enviada_al_cotizador: cerrar contexto de esa cotización.
- modificacion_cotizacion_existente: solo modificar si viene número/código de cotización.

Regla crítica:
Si el usuario manda una nueva medida después de haber enviado una cotización al cotizador, tratala como nueva consulta rápida, salvo que indique explícitamente el número de cotización a modificar.

Reglas AI-06:
- No inventar precios.
- No inventar proveedores.
- No inventar materiales.
- Si no hay coincidencias, indicar pendiente de validación.
- Si hay medidas, calcular área aproximada.
- Si aplica producción, usar produccion_preliminar.

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
      status: "online"
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

    const memoriaOperativa = memoriaOperativaBase || await cargarMemoriaOperativaDesdeSupabase({
      entradaUsuario: textoUsuario,
      unidad,
    });

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
        { role: 'developer', content: construirContextoMemoriaOperativa(memoriaOperativa) },
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









