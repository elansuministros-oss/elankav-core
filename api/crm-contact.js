import { normalizeKey, normalizeText } from '../lib/crm-domain.js';

const normalize = value => normalizeText(value);

function getBearerToken(req) {
  const header = normalize(req.headers?.authorization);
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return normalize(header.slice(7));
}

function requireAdmin(req) {
  const token = getBearerToken(req);
  const accepted = [
    normalize(process.env.KAVTORE_SESSION_TOKEN),
    normalize(process.env.CRM_INTERNAL_TOKEN)
  ].filter(Boolean);
  if (!accepted.length) return { ok: false, status: 500, error: 'CRM_ADMIN_TOKEN_NOT_CONFIGURED' };
  if (!token || !accepted.includes(token)) return { ok: false, status: 401, error: 'CRM_UNAUTHORIZED' };
  return { ok: true };
}

function getSupabaseConfig() {
  const url = normalize(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const key = normalize(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  if (!url || !key) throw new Error('CRM_SUPABASE_SERVER_CONFIG_MISSING');
  return { url, key };
}

async function db(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `CRM_SUPABASE_HTTP_${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function normalizeWhatsapp(value, countryCallingCode = '505') {
  const raw = normalize(value);
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  if (raw.startsWith('+') || raw.startsWith('00')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  if (digits.length === 8) return `+${countryCallingCode}${digits}`;
  if (digits.startsWith(countryCallingCode) && digits.length > countryCallingCode.length + 6) return `+${digits}`;
  return '';
}

async function findSupplier(name) {
  const key = normalizeKey(name);
  if (!key) return { ok: false, statusCode: 400, error: 'CRM_SUPPLIER_NAME_REQUIRED' };
  const rows = await db('crm_identities', {
    query: 'select=' + encodeURIComponent('id,display_name,entity_type,status') + '&entity_type=eq.supplier&status=eq.active&limit=500'
  });
  const matches = (Array.isArray(rows) ? rows : []).filter(row => normalizeKey(row.display_name).includes(key));
  if (!matches.length) return { ok: false, statusCode: 404, error: 'CRM_SUPPLIER_NOT_FOUND' };
  if (matches.length > 1) return { ok: false, statusCode: 409, status: 'MULTIPLE_MATCHES', error: 'CRM_SUPPLIER_MULTIPLE_MATCHES', candidates: matches };
  return { ok: true, statusCode: 200, status: 'FOUND', supplier: matches[0] };
}

async function listContacts(identityId) {
  if (!normalize(identityId)) return { ok: false, statusCode: 400, error: 'CRM_CONTACT_IDENTITY_REQUIRED' };
  const rows = await db('crm_contacts', {
    query: 'select=' + encodeURIComponent('id,identity_id,contact_name,role_or_area,whatsapp,phone,email,country,city,address,notes,is_primary,status') + `&identity_id=eq.${encodeURIComponent(identityId)}&status=eq.active&order=is_primary.desc,created_at.asc`
  });
  return { ok: true, statusCode: 200, status: 'READY', contacts: Array.isArray(rows) ? rows : [] };
}

async function audit(action, entityId, payload) {
  await db('crm_audit_events', {
    method: 'POST',
    body: { action, entity_type: 'contact', entity_id: entityId, actor_type: 'internal_token', payload: payload || {} }
  });
}

async function addContact(input) {
  const identityId = normalize(input.identityId);
  const whatsapp = normalizeWhatsapp(input.whatsapp, normalize(input.countryCallingCode) || '505');
  if (!identityId) return { ok: false, statusCode: 400, error: 'CRM_CONTACT_IDENTITY_REQUIRED' };
  if (!whatsapp) return { ok: false, statusCode: 400, error: 'CRM_CONTACT_WHATSAPP_INVALID' };
  const rows = await db('crm_contacts', {
    method: 'POST',
    body: {
      identity_id: identityId,
      contact_name: normalize(input.contactName) || null,
      role_or_area: normalize(input.contactRole) || null,
      whatsapp,
      phone: normalize(input.phone) || null,
      email: normalize(input.email).toLowerCase() || null,
      country: normalize(input.country) || null,
      city: normalize(input.city) || null,
      address: normalize(input.address) || null,
      notes: normalize(input.notes) || null,
      is_primary: input.isPrimary === true,
      status: 'active'
    }
  });
  const contact = rows?.[0] || null;
  if (!contact?.id) throw new Error('CRM_CONTACT_NOT_CREATED');
  await audit('add_contact', contact.id, { identityId, whatsapp });
  return { ok: true, statusCode: 201, status: 'CREATED', contact };
}

async function updateContact(input) {
  const contactId = normalize(input.contactId);
  const identityId = normalize(input.identityId);
  if (!contactId || !identityId) return { ok: false, statusCode: 400, error: 'CRM_CONTACT_ID_REQUIRED' };
  const patch = { updated_at: new Date().toISOString() };
  const allowed = {
    contactName: 'contact_name', contactRole: 'role_or_area', phone: 'phone', email: 'email',
    country: 'country', city: 'city', address: 'address', notes: 'notes', isPrimary: 'is_primary'
  };
  for (const [inputKey, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(input, inputKey)) patch[column] = input[inputKey] === '' ? null : input[inputKey];
  }
  if (Object.prototype.hasOwnProperty.call(input, 'whatsapp')) {
    const whatsapp = normalizeWhatsapp(input.whatsapp, normalize(input.countryCallingCode) || '505');
    if (!whatsapp) return { ok: false, statusCode: 400, error: 'CRM_CONTACT_WHATSAPP_INVALID' };
    patch.whatsapp = whatsapp;
  }
  const rows = await db('crm_contacts', {
    method: 'PATCH',
    query: `id=eq.${encodeURIComponent(contactId)}&identity_id=eq.${encodeURIComponent(identityId)}&status=eq.active`,
    body: patch
  });
  const contact = rows?.[0] || null;
  if (!contact?.id) return { ok: false, statusCode: 404, error: 'CRM_CONTACT_NOT_FOUND' };
  await audit('update_contact', contact.id, { identityId, fields: Object.keys(patch) });
  return { ok: true, statusCode: 200, status: 'UPDATED', contact };
}

function send(res, result) {
  return res.status(result.statusCode).json(result);
}

export default async function handler(req, res) {
  const authorization = requireAdmin(req);
  if (!authorization.ok) return res.status(authorization.status).json({ ok: false, status: 'ACCESS_DENIED', error: authorization.error });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, status: 'ERROR', error: 'CRM_METHOD_NOT_ALLOWED' });
  try {
    const action = normalize(req.body?.action);
    if (action === 'find_supplier') return send(res, await findSupplier(req.body?.name));
    if (action === 'list_contacts') return send(res, await listContacts(req.body?.identityId));
    if (action === 'add_contact') return send(res, await addContact(req.body || {}));
    if (action === 'update_contact') return send(res, await updateContact(req.body || {}));
    return res.status(400).json({ ok: false, status: 'ERROR', error: 'CRM_ACTION_INVALID' });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, status: 'ERROR', error: String(error.message || 'CRM_CONTACT_API_ERROR'), details: error.details || null });
  }
}
