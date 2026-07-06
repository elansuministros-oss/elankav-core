import { buildLeadFieldsFromSalesResult } from '../elan-sales-engine/lead-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const BASE_LEAD_COLUMNS = new Set([
  'origen',
  'nombre',
  'whatsapp',
  'mensaje',
  'unidad_negocio',
  'servicio_solicitado',
  'tipo_cliente',
  'estado',
  'prioridad',
  'respuesta_sugerida',
  'mensaje_original',
  'creado_por',
  'listo_para_crm',
  'procesado',
  'source',
  'message_id',
  'chat_id',
]);

function filterBaseLeadColumns(lead = {}) {
  return Object.fromEntries(Object.entries(lead).filter(([key]) => BASE_LEAD_COLUMNS.has(key)));
}

function getSupabaseBaseUrl() {
  return SUPABASE_URL.replace(/\/$/, '');
}

function getSupabaseHeaders(prefer = 'return=representation') {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (prefer) headers.Prefer = prefer;
  return headers;
}

function buildLead(normalized = {}, salesResult = {}) {
  if (salesResult?.leadFields) {
    return filterBaseLeadColumns(salesResult.leadFields);
  }

  if (salesResult?.analysis || salesResult?.responseText) {
    return filterBaseLeadColumns(buildLeadFieldsFromSalesResult(normalized, salesResult));
  }

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

async function requestLeads(path, options = {}) {
  const response = await fetch(`${getSupabaseBaseUrl()}/rest/v1/leads_whatsapp${path}`, {
    ...options,
    headers: {
      ...getSupabaseHeaders(options.prefer),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : data?.message || data?.error || 'Supabase request failed',
  };
}

async function findLeadBy(column, value) {
  if (!value) return null;

  const params = new URLSearchParams();
  params.set('select', 'id,chat_id,whatsapp,message_id');
  params.set(column, `eq.${value}`);
  params.set('limit', '1');

  const result = await requestLeads(`?${params.toString()}`, {
    method: 'GET',
    prefer: '',
  });

  if (!result.ok) return null;
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function findExistingLead(normalized = {}) {
  const whatsapp = String(normalized.chatId || normalized.from || '').replace('@c.us', '');

  return (
    (await findLeadBy('message_id', normalized.messageId)) ||
    (await findLeadBy('chat_id', normalized.chatId)) ||
    (await findLeadBy('whatsapp', whatsapp))
  );
}

async function insertLead(lead) {
  return await requestLeads('', {
    method: 'POST',
    body: JSON.stringify(lead),
  });
}

async function updateLead(existingLead, lead) {
  if (!existingLead?.id) return await insertLead(lead);

  const params = new URLSearchParams();
  params.set('id', `eq.${existingLead.id}`);

  return await requestLeads(`?${params.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify(lead),
  });
}

export async function saveLeadFromWahaEvent(normalized = {}, salesResult = {}) {
  if (!normalized.isLeadCandidate) {
    return {
      ok: true,
      skipped: true,
      reason: 'Evento WAHA no aplica como lead',
    };
  }

  const lead = buildLead(normalized, salesResult);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      ok: false,
      skipped: false,
      error: 'Supabase no configurado',
      lead,
    };
  }

  const existingLead = await findExistingLead(normalized);
  const result = existingLead ? await updateLead(existingLead, lead) : await insertLead(lead);

  if (!result.ok) {
    return {
      ok: false,
      updated: Boolean(existingLead),
      error: result.error || 'No se pudo guardar lead WAHA',
      data: result.data,
      lead,
    };
  }

  return {
    ok: true,
    updated: Boolean(existingLead),
    data: result.data,
    lead,
  };
}
