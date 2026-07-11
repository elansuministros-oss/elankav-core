function authorize(req) {
  const expected = String(process.env.KAVTORE_SESSION_TOKEN || '').trim();
  const received = String(req.headers?.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  return Boolean(expected && received && expected === received);
}

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ''
  ).trim();

  if (!url || !key) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return { url, key };
}

async function supabaseRequest(table, options = {}) {
  const { method = 'GET', query = '', body } = options;
  const { url, key } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/${table}${query ? `?${query}` : ''}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer:
        method === 'POST'
          ? 'return=representation,resolution=merge-duplicates'
          : 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(`SUPABASE_${response.status}`);
    error.detail = data;
    throw error;
  }

  return data;
}

async function loadDashboard() {
  const identities = await supabaseRequest('crm_identities', {
    query:
      'select=id,canonical_id,display_name,entity_type,created_at&order=created_at.desc&limit=25'
  });

  const conversations = await supabaseRequest('crm_conversations', {
    query:
      'select=id,identity_id,channel,platform,stage,status,created_at&order=created_at.desc&limit=25'
  });

  const messages = await supabaseRequest('crm_messages', {
    query:
      'select=id,conversation_id,direction,body,status,created_at&order=created_at.desc&limit=25'
  });

  return {
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

export default async function handler(req, res) {
  if (!authorize(req)) {
    return res.status(401).json({
      ok: false,
      status: 'UNAUTHORIZED',
      error: 'UNAUTHORIZED'
    });
  }

  try {
    if (req.method === 'GET') {
      const data = await loadDashboard();
      return res.status(200).json({
        ok: true,
        status: 'READY',
        version: 'CRM-001E',
        ...data
      });
    }

    if (req.method === 'POST') {
      const displayName = String(req.body?.displayName || '').trim();
      const canonicalId = String(req.body?.canonicalId || '').trim();
      const entityType = String(req.body?.entityType || 'client')
        .trim()
        .toLowerCase();

      if (!displayName || !canonicalId) {
        return res.status(400).json({
          ok: false,
          status: 'INVALID_INPUT',
          error: 'DISPLAY_NAME_AND_CANONICAL_ID_REQUIRED'
        });
      }

      const created = await supabaseRequest('crm_identities', {
        method: 'POST',
        body: {
          canonical_id: canonicalId,
          display_name: displayName,
          entity_type: entityType,
          metadata: { source: 'crm-ui-validation' }
        }
      });

      return res.status(201).json({
        ok: true,
        status: 'READY',
        identity: created?.[0] || null
      });
    }

    return res.status(405).json({
      ok: false,
      status: 'METHOD_NOT_ALLOWED',
      error: 'METHOD_NOT_ALLOWED'
    });
  } catch (error) {
    const detailText = JSON.stringify(error.detail || {});
    const migrationPending =
      error.message === 'SUPABASE_404' ||
      detailText.includes('crm_identities') ||
      detailText.includes('crm_conversations') ||
      detailText.includes('crm_messages');

    return res.status(500).json({
      ok: false,
      status: migrationPending ? 'MIGRATION_PENDING' : 'ERROR',
      error: error.message,
      detail: error.detail || null
    });
  }
}
