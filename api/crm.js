const CRM_TABLES = {
  identities: {
    table: 'crm_identities',
    select: 'id,canonical_id,display_name,entity_type,created_at'
  },
  conversations: {
    table: 'crm_conversations',
    select: 'id,identity_id,channel,platform,stage,status,created_at'
  },
  messages: {
    table: 'crm_messages',
    select: 'id,conversation_id,direction,body,status,created_at'
  }
};

function normalize(value) {
  return String(value || '').trim();
}

function getBearerToken(req) {
  const header = normalize(req.headers?.authorization);

  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return normalize(header.slice(7));
}

function requireAdmin(req) {
  const receivedToken = getBearerToken(req);

  const acceptedTokens = [
    normalize(process.env.KAVTORE_SESSION_TOKEN),
    normalize(process.env.CRM_INTERNAL_TOKEN)
  ].filter(Boolean);

  if (!acceptedTokens.length) {
    return {
      ok: false,
      status: 500,
      error: 'CRM_ADMIN_TOKEN_NOT_CONFIGURED'
    };
  }

  if (!receivedToken || !acceptedTokens.includes(receivedToken)) {
    return {
      ok: false,
      status: 401,
      error: 'CRM_UNAUTHORIZED'
    };
  }

  return { ok: true };
}

function getSupabaseConfig() {
  const url = normalize(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const key = normalize(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY
  );

  if (!url || !key) {
    throw new Error('CRM_SUPABASE_SERVER_CONFIG_MISSING');
  }

  return { url, key };
}

async function supabaseRequest(
  table,
  {
    method = 'GET',
    query = '',
    body
  } = {}
) {
  const { url, key } = getSupabaseConfig();

  const response = await fetch(
    `${url}/rest/v1/${table}${query ? `?${query}` : ''}`,
    {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer:
          method === 'POST'
            ? 'return=representation'
            : 'return=representation'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      `CRM_SUPABASE_HTTP_${response.status}`
    );

    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function listRecent({ table, select }) {
  const query =
    `select=${encodeURIComponent(select)}` +
    '&order=created_at.desc' +
    '&limit=25';

  const rows = await supabaseRequest(table, { query });
  return Array.isArray(rows) ? rows : [];
}

async function loadDashboard() {
  const [identities, conversations, messages] = await Promise.all([
    listRecent(CRM_TABLES.identities),
    listRecent(CRM_TABLES.conversations),
    listRecent(CRM_TABLES.messages)
  ]);

  return {
    ok: true,
    status: 'READY',
    version: 'CRM-040A',
    identities,
    conversations,
    messages,
    counts: {
      identities: identities.length,
      conversations: conversations.length,
      messages: messages.length
    }
  };
}

async function createIdentity(input) {
  const displayName = normalize(input?.displayName);
  const canonicalId = normalize(input?.canonicalId);
  const entityType = normalize(input?.entityType) || 'client';

  if (!displayName || !canonicalId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'CRM_IDENTITY_INPUT_INVALID'
    };
  }

  const rows = await supabaseRequest('crm_identities', {
    method: 'POST',
    body: {
      canonical_id: canonicalId,
      display_name: displayName,
      entity_type: entityType,
      metadata: {
        source: 'crm-ui-validation'
      }
    }
  });

  return {
    ok: true,
    statusCode: 201,
    status: 'READY',
    identity: rows?.[0] || null
  };
}

export default async function handler(req, res) {
  const authorization = requireAdmin(req);

  if (!authorization.ok) {
    return res.status(authorization.status).json({
      ok: false,
      status: 'ACCESS_DENIED',
      error: authorization.error
    });
  }

  try {
    if (req.method === 'GET') {
      const dashboard = await loadDashboard();
      return res.status(200).json(dashboard);
    }

    if (req.method === 'POST') {
      const action = normalize(req.body?.action);

      if (action !== 'create_identity') {
        return res.status(400).json({
          ok: false,
          status: 'ERROR',
          error: 'CRM_ACTION_INVALID'
        });
      }

      const result = await createIdentity(req.body);

      if (!result.ok) {
        return res.status(result.statusCode).json({
          ok: false,
          status: 'ERROR',
          error: result.error
        });
      }

      return res.status(result.statusCode).json({
        ok: true,
        status: result.status,
        identity: result.identity
      });
    }

    return res.status(405).json({
      ok: false,
      status: 'ERROR',
      error: 'CRM_METHOD_NOT_ALLOWED'
    });
  } catch (error) {
    const message = String(error?.message || 'CRM_API_ERROR');

    const migrationPending =
      message.toLowerCase().includes('could not find the table') ||
      message.toLowerCase().includes('does not exist') ||
      message.toLowerCase().includes('relation');

    return res.status(500).json({
      ok: false,
      status: migrationPending ? 'MIGRATION_PENDING' : 'ERROR',
      error: message,
      details: error?.details || null
    });
  }
}
