const MAX_MENSAJES_CONTEXTO = 12;
const MAX_MENSAJES_GUARDADOS = 24;
const MAX_CARACTERES_MENSAJE = 2000;

export function normalizarWhatsApp(valor = "") {
  const normalizado = String(valor || "").replace(/\D/g, "");
  return normalizado || "";
}

export function obtenerIdentificadorConversacion(whatsapp = "") {
  const numero = normalizarWhatsApp(whatsapp);
  return numero ? `whatsapp:${numero}` : "";
}

function normalizarRol(rol = "") {
  return rol === "assistant" ? "assistant" : "user";
}

function normalizarMensaje(mensaje = {}) {
  const role = normalizarRol(mensaje.role || mensaje.rol);
  const content = String(mensaje.content || mensaje.contenido || "").trim();

  if (!content) return null;

  return {
    role,
    content: content.slice(0, MAX_CARACTERES_MENSAJE),
  };
}

export function normalizarContexto(contexto = []) {
  if (!Array.isArray(contexto)) return [];
  return contexto.map(normalizarMensaje).filter(Boolean);
}

export function recortarContextoParaPrompt(contexto = []) {
  return normalizarContexto(contexto).slice(-MAX_MENSAJES_CONTEXTO);
}

export function construirContextoActualizado({
  contextoPrevio = [],
  mensajeUsuario = "",
  respuestaAsistente = "",
} = {}) {
  return normalizarContexto([
    ...normalizarContexto(contextoPrevio),
    { role: "user", content: mensajeUsuario },
    { role: "assistant", content: respuestaAsistente },
  ]).slice(-MAX_MENSAJES_GUARDADOS);
}

export async function obtenerMemoriaConversacion({
  supabase = null,
  whatsapp = "",
} = {}) {
  const whatsappNormalizado = normalizarWhatsApp(whatsapp);
  const conversationId = obtenerIdentificadorConversacion(whatsappNormalizado);

  if (!conversationId) {
    return {
      ok: true,
      habilitada: false,
      conversationId: "",
      whatsapp: "",
      contexto: [],
      estado: "sin_whatsapp",
    };
  }

  if (!supabase) {
    return {
      ok: false,
      habilitada: false,
      conversationId,
      whatsapp: whatsappNormalizado,
      contexto: [],
      estado: "supabase_no_configurado",
    };
  }

  const { data, error } = await supabase
    .from("elan_ai_conversaciones")
    .select("contexto")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      habilitada: true,
      conversationId,
      whatsapp: whatsappNormalizado,
      contexto: [],
      estado: "error_lectura",
      error: error.message,
    };
  }

  return {
    ok: true,
    habilitada: true,
    conversationId,
    whatsapp: whatsappNormalizado,
    contexto: recortarContextoParaPrompt(data?.contexto || []),
    estado: data ? "recuperada" : "nueva",
  };
}

export async function guardarMemoriaConversacion({
  supabase = null,
  whatsapp = "",
  contextoPrevio = [],
  mensajeUsuario = "",
  respuestaAsistente = "",
} = {}) {
  const whatsappNormalizado = normalizarWhatsApp(whatsapp);
  const conversationId = obtenerIdentificadorConversacion(whatsappNormalizado);

  if (!conversationId) {
    return {
      ok: true,
      habilitada: false,
      conversationId: "",
      estado: "sin_whatsapp",
    };
  }

  if (!supabase) {
    return {
      ok: false,
      habilitada: false,
      conversationId,
      estado: "supabase_no_configurado",
    };
  }

  const contexto = construirContextoActualizado({
    contextoPrevio,
    mensajeUsuario,
    respuestaAsistente,
  });

  const { error } = await supabase
    .from("elan_ai_conversaciones")
    .upsert(
      {
        conversation_id: conversationId,
        whatsapp: whatsappNormalizado,
        contexto,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "conversation_id" }
    );

  if (error) {
    return {
      ok: false,
      habilitada: true,
      conversationId,
      estado: "error_escritura",
      error: error.message,
    };
  }

  return {
    ok: true,
    habilitada: true,
    conversationId,
    contexto,
    estado: "guardada",
  };
}
