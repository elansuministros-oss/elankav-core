'use strict';

function getConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    throw new Error('CRM_SUPABASE_NOT_CONFIGURED');
  }

  return { url, key };
}

async function request(table, { method = 'GET', query = '', body } = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST'
        ? 'return=representation,resolution=merge-duplicates'
        : 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`CRM_SUPABASE_${response.status}:${JSON.stringify(data)}`);
  }

  return data;
}

async function findIdentityByAlias(channel, externalId) {
  const rows = await request('crm_identity_aliases', {
    query: `select=id,identity_id,channel,external_id,alias_type,is_primary,crm_identities(*)&channel=eq.${encodeURIComponent(channel)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`
  });
  return rows?.[0] || null;
}

async function createIdentity(identity) {
  const rows = await request('crm_identities', {
    method: 'POST',
    body: identity
  });
  return rows?.[0] || null;
}

async function createAlias(alias) {
  const rows = await request('crm_identity_aliases', {
    method: 'POST',
    body: alias
  });
  return rows?.[0] || null;
}

async function findConversation(channel, externalConversationId) {
  const rows = await request('crm_conversations', {
    query: `select=*&channel=eq.${encodeURIComponent(channel)}&external_conversation_id=eq.${encodeURIComponent(externalConversationId)}&limit=1`
  });
  return rows?.[0] || null;
}

async function createConversation(conversation) {
  const rows = await request('crm_conversations', {
    method: 'POST',
    body: conversation
  });
  return rows?.[0] || null;
}

async function createMessage(message) {
  const rows = await request('crm_messages', {
    method: 'POST',
    body: message
  });
  return rows?.[0] || null;
}

module.exports = {
  getConfig,
  findIdentityByAlias,
  createIdentity,
  createAlias,
  findConversation,
  createConversation,
  createMessage
};
