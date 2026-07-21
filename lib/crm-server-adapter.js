import { normalizeText } from './crm-domain.js';

const clean = (value) => normalizeText(value);

function getCrmServerConfig(env = process.env) {
  const url = clean(env.SUPABASE_URL).replace(/\/+$/, '');
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY);

  if (!url || !key) {
    throw new Error('CRM_SUPABASE_SERVER_CONFIG_MISSING');
  }

  return { url, key };
}

function getInternalToken(req) {
  const header = clean(req?.headers?.authorization);
  return header.toLowerCase().startsWith('bearer ')
    ? clean(header.slice(7))
    : '';
}

function authorizeCrmRequest(req, env = process.env) {
  const received = getInternalToken(req);
  const accepted = [
    clean(env.KAVTORE_SESSION_TOKEN),
    clean(env.CRM_INTERNAL_TOKEN)
  ].filter(Boolean);

  if (!accepted.length) {
    return { ok: false, statusCode: 500, error: 'CRM_ADMIN_TOKEN_NOT_CONFIGURED' };
  }

  if (!received || !accepted.includes(received)) {
    return { ok: false, statusCode: 401, error: 'CRM_UNAUTHORIZED' };
  }

  return { ok: true };
}

function buildSupabaseHeaders(key, { count = false, prefer } = {}) {
  const headers = {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  if (!key.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`;
  }

  const preferences = [];
  if (count) preferences.push('count=exact');
  if (prefer) preferences.push(prefer);
  if (preferences.length) headers.Prefer = preferences.join(',');

  return headers;
}

function parseExactCount(contentRange) {
  const value = clean(contentRange);
  const match = value.match(/\/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function crmSupabaseRequest(
  table,
  {
    method = 'GET',
    query = '',
    body,
    count = false,
    prefer,
    env = process.env,
    fetchImpl = fetch
  } = {}
) {
  const { url, key } = getCrmServerConfig(env);
  const response = await fetchImpl(
    `${url}/rest/v1/${table}${query ? `?${query}` : ''}`,
    {
      method,
      headers: buildSupabaseHeaders(key, { count, prefer }),
      body: body === undefined ? undefined : JSON.stringify(body)
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.message || payload?.error || `CRM_SUPABASE_HTTP_${response.status}`
    );
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return {
    data: payload,
    count: count ? parseExactCount(response.headers?.get?.('content-range')) : null
  };
}

export {
  authorizeCrmRequest,
  buildSupabaseHeaders,
  crmSupabaseRequest,
  getCrmServerConfig,
  parseExactCount
};
