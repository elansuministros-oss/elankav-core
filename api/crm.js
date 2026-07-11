const TABLES = {
  identities: 'crm_identities',
  conversations: 'crm_conversations',
  messages: 'crm_messages'
};

function authorize(req) {
  const expected = String(process.env.KAVTORE_SESSION_TOKEN || '').trim();
  const received = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return Boolean(expected && received && expected === received);
}

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  return { url, key };
}

async function rest(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
  const { url, key } = config();
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
    const error = new Error(`SUPABASE_${response.status}`);
    error.detail = data;
    throw error;
  }
  return data;
}

async function dashboard() {
  const [identities, conversations, messages] = await Promise.all([
    rest(TABLES.identities, { query: 'select=id,canonical_id,display_name,entity_type,created_at&order=created_at.desc&limit=25' }),
    rest(TABLES.conversations, { query: 'select=id,identity_id,channel,platform,stage,status,created_at&order=created_at.desc&limit=25' }),
    rest(TABLES.messages, { query: 'select=id,conversation_id,direction,body,status,created_at&order=created_at.desc&limit=25' })
  ]);
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
  if (!authorize(req)) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });

  try {
    if (req.method === 'GET') {
      const data = await dashboard();
      return res.status(200).json({ ok: true, status: 'READY', version: 'CRM-001B', ...data });
    }

    if (req.method === 'POST') {
      const displayName = String(req.body?.displayName || '').trim();
      const canonicalId = String(req.body?.canonicalId || '').trim();
      const entityType = String(req.body?.entityType || 'client').trim().toLowerCase();
      if (!displayName || !canonicalId) {
        return res.status(400).json({ ok: false, error: 'DISPLAY_NAME_AND_CANONICAL_ID_REQUIRED' });
      }

      const created = await rest(TABLES.identities, {
        method: 'POST',
        body: {
          canonical_id: canonicalId,
          display_name: displayName,
          entity_type: entityType,
          metadata: { source: 'crm-ui-validation' }
        },
        prefer: 'return=representation,resolution=merge-duplicates'
      });

      return res.status(201).json({ ok: true, identity: created?.[0] || null });
    }

    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const migrationPending = String(error.detail || '').includes('crm_') || error.message.includes('SUPABASE_404');
    return res.status(500).json({
      ok: false,
      status: migrationPending ? 'MIGRATION_PENDING' : 'ERROR',
      error: error.message,
      detail: error.detail || null
    });
  }
}
