'use strict';

const crmAdapter = require('../adapters/crmSupabaseAdapter');

function normalizeExternalId(value) {
  return String(value || '').trim();
}

function normalizePlatform(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

async function ensureIdentity({
  channel,
  externalId,
  canonicalId,
  displayName = null,
  entityType = 'unknown',
  metadata = {}
}) {
  const normalizedExternalId = normalizeExternalId(externalId);
  if (!channel || !normalizedExternalId) {
    throw new Error('CRM_IDENTITY_INPUT_INVALID');
  }

  const existing = await crmAdapter.findIdentityByAlias(
    channel,
    normalizedExternalId
  );

  if (existing) {
    return {
      identity: existing.crm_identities,
      alias: existing,
      created: false
    };
  }

  const identity = await crmAdapter.createIdentity({
    canonical_id: String(canonicalId || normalizedExternalId),
    display_name: displayName,
    entity_type: entityType,
    metadata
  });

  const alias = await crmAdapter.createAlias({
    identity_id: identity.id,
    channel,
    external_id: normalizedExternalId,
    alias_type: 'channel_id',
    is_primary: true,
    metadata: {}
  });

  return { identity, alias, created: true };
}

async function ensureConversation({
  identityId,
  channel,
  externalConversationId,
  platform,
  metadata = {}
}) {
  if (!identityId || !channel || !externalConversationId) {
    throw new Error('CRM_CONVERSATION_INPUT_INVALID');
  }

  const existing = await crmAdapter.findConversation(
    channel,
    externalConversationId
  );

  if (existing) {
    return { conversation: existing, created: false };
  }

  const conversation = await crmAdapter.createConversation({
    identity_id: identityId,
    channel,
    platform: normalizePlatform(platform) || null,
    external_conversation_id: externalConversationId,
    stage: 'new',
    status: 'open',
    metadata
  });

  return { conversation, created: true };
}

async function registerMessage({
  conversationId,
  externalMessageId = null,
  direction,
  senderIdentityId = null,
  body,
  messageType = 'text',
  status = 'received',
  rawPayload = null,
  metadata = {}
}) {
  if (!conversationId || !direction || !String(body || '').trim()) {
    throw new Error('CRM_MESSAGE_INPUT_INVALID');
  }

  return crmAdapter.createMessage({
    conversation_id: conversationId,
    external_message_id: externalMessageId,
    direction,
    sender_identity_id: senderIdentityId,
    body: String(body).trim(),
    message_type: messageType,
    status,
    raw_payload: rawPayload,
    metadata
  });
}

module.exports = {
  ensureIdentity,
  ensureConversation,
  registerMessage,
  normalizeExternalId,
  normalizePlatform
};
