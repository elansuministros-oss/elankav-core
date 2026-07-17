import { normalizePhone, normalizeKey, normalizeText } from '../lib/crm-domain.js';

const clean = (value) => normalizeText(value);

function authorized(req) {
  const header = clean(req.headers?.authorization);
  const token = header.toLowerCase().startsWith('bearer ') ? clean(header.slice(7)) : '';
  const accepted = [clean(process.env.KAVTORE_SESSION_TOKEN), clean(process.env.CRM_INTERNAL_TOKEN)].filter(Boolean);
  return accepted.length > 0 && accepted.includes(token);
}

async function readTable(table, query) {
  const url = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  if (!url || !key) throw new Error('CRM_SUPABASE_SERVER_CONFIG_MISSING');
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `CRM_SUPABASE_HTTP_${response.status}`);
  return Array.isArray(payload) ? payload : [];
}

function matches(identity, query) {
  const q = normalizeKey(query);
  const phone = normalizePhone(query);
  return normalizeKey(identity.display_name).includes(q) ||
    (phone && normalizePhone(identity.metadata?.phone).includes(phone)) ||
    normalizeKey(identity.metadata?.email).includes(q);
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'CRM_UNAUTHORIZED' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'CRM_METHOD_NOT_ALLOWED' });

  const query = clean(req.query?.q);
  if (query.length < 2) return res.status(422).json({ ok: false, error: 'CRM_CLIENT_QUERY_TOO_SHORT' });
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 12, 1), 50);
  const platform = clean(req.query?.platform).toLowerCase();

  try {
    const identities = await readTable(
      'crm_identities',
      'select=id,canonical_id,display_name,status,metadata&entity_type=eq.client&status=eq.active&limit=500'
    );
    const selected = identities.filter((identity) => matches(identity, query));
    const ids = selected.map((identity) => identity.id);
    let relationships = [];
    if (ids.length) {
      const filter = ids.map((id) => `\"${id}\"`).join(',');
      relationships = await readTable(
        'crm_client_relationships',
        `select=id,identity_id,platform,status,metadata&identity_id=in.(${filter})&status=eq.active`
      );
    }

    const clients = selected
      .map((identity) => ({
        customerId: identity.id,
        canonicalId: identity.canonical_id,
        name: identity.display_name,
        phone: normalizePhone(identity.metadata?.phone),
        email: clean(identity.metadata?.email),
        address: clean(identity.metadata?.address),
        relationships: relationships.filter((item) => item.identity_id === identity.id)
      }))
      .filter((client) => !platform || client.relationships.some((item) => item.platform === platform))
      .slice(0, limit);

    return res.status(200).json({ ok: true, status: 'READY', clients });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error?.message || 'CRM_CLIENT_SEARCH_ERROR') });
  }
}
