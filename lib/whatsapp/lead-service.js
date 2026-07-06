const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

function buildLead(normalized = {}) {
  return {
    origen: 'WAHA',
    nombre: normalized.from || normalized.chatId || 'Cliente WhatsApp',
    whatsapp: String(normalized.chatId || normalized.from || '').replace('@c.us', ''),
    mensaje: normalized.body || '',
    unidad_negocio: 'Sin clasificar',
    servicio_solicitado: 'Consulta WhatsApp',
    tipo_cliente: 'Prospecto',
    estado: 'Nuevo',
    prioridad: 'Media',
    respuesta_sugerida: '',
    mensaje_original: normalized.body || '',
    creado_por: 'WAHA Gateway',
    listo_para_crm: true,
    procesado: false,
    source: 'WAHA',
    message_id: normalized.messageId || null,
    chat_id: normalized.chatId || null,
  };
}

export async function saveLeadFromWahaEvent(normalized = {}) {
  if (!normalized.isLeadCandidate) {
    return {
      ok: true,
      skipped: true,
      reason: 'Evento WAHA no aplica como lead',
    };
  }

  const lead = buildLead(normalized);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      ok: false,
      skipped: false,
      error: 'Supabase no configurado',
      lead,
    };
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/leads_whatsapp`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(lead),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: data?.message || data?.error || 'No se pudo guardar lead WAHA',
      data,
      lead,
    };
  }

  return {
    ok: true,
    data,
    lead,
  };
}
