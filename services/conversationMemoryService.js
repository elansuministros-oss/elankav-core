import { randomUUID } from 'node:crypto';

const DEFAULT_HISTORY_LIMIT = 12;
const MAX_MESSAGE_LENGTH = 4000;

let defaultSupabase;

function normalize(value) {
  return String(value || '').trim();
}

async function getDefaultSupabase() {
  if (defaultSupabase === undefined) {
    const { crearClienteSupabase } = await import('../lib/memoria-operativa.js');
    defaultSupabase = crearClienteSupabase();
  }

  return defaultSupabase;
}

function isOwnerIdentity(identity = {}) {
  return (
    normalize(identity.entityType).toLowerCase() === 'owner' ||
    (Array.isArray(identity.roles) &&
      identity.roles.some(role => normalize(role).toLowerCase() === 'owner'))
  );
}

function buildExternalConversationId({
  channel = 'whatsapp',
  platform,
  externalUserId
} = {}) {
  const normalizedChannel = normalize(channel).toLowerCase();
  const normalizedPlatform = normalize(platform).toLowerCase();
  const normalizedUser = normalize(externalUserId);

  if (!normalizedChannel || !normalizedPlatform || !normalizedUser) {
    return '';
  }

  return `${normalizedChannel}:${normalizedPlatform}:${normalizedUser}`;
}

function normalizeHistoryRows(rows = [], limit = DEFAULT_HISTORY_LIMIT) {
  if (!Array.isArray(rows)) return [];

  return rows
    .slice(0, Math.max(0, Number(limit) || DEFAULT_HISTORY_LIMIT))
    .reverse()
    .map(row => ({
      role: row?.direction === 'outbound' ? 'assistant' : 'user',
      content: normalize(row?.body).slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter(message => message.content);
}

async function findIdentity(supabase, canonicalId) {
  const { data, error } = await supabase
    .from('crm_identities')
    .select('id,canonical_id,display_name,entity_type,status')
    .eq('canonical_id', canonicalId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureIdentity(supabase, identity = {}, readOnly = false) {
  const canonicalId = normalize(identity.canonicalId);
  if (!canonicalId) return null;

  const existing = await findIdentity(supabase, canonicalId);
  if (existing || readOnly) return existing;

  const entityType =
    normalize(identity.entityType).toLowerCase() === 'unknown'
      ? 'client'
      : normalize(identity.entityType).toLowerCase() || 'client';

  const { data, error } = await supabase
    .from('crm_identities')
    .insert({
      canonical_id: canonicalId,
      display_name: normalize(identity.name) || `WhatsApp ${canonicalId}`,
      entity_type: entityType,
      metadata: {
        source: 'whatsapp-v2',
        phone: canonicalId
      }
    })
    .select('id,canonical_id,display_name,entity_type,status')
    .single();

  if (!error) return data || null;

  if (String(error.code || '') === '23505') {
    return findIdentity(supabase, canonicalId);
  }

  throw error;
}

async function findConversation(supabase, externalConversationId) {
  const { data, error } = await supabase
    .from('crm_conversations')
    .select('id,identity_id,channel,platform,external_conversation_id,status')
    .eq('channel', 'whatsapp')
    .eq('external_conversation_id', externalConversationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureConversation({
  supabase,
  identityId,
  platform,
  externalConversationId,
  readOnly = false
}) {
  const existing = await findConversation(supabase, externalConversationId);
  if (existing || readOnly) return existing;

  const { data, error } = await supabase
    .from('crm_conversations')
    .insert({
      identity_id: identityId,
      channel: 'whatsapp',
      platform,
      external_conversation_id: externalConversationId,
      stage: 'new',
      status: 'open',
      metadata: { source: 'whatsapp-v2' }
    })
    .select('id,identity_id,channel,platform,external_conversation_id,status')
    .single();

  if (!error) return data || null;

  if (String(error.code || '') === '23505') {
    return findConversation(supabase, externalConversationId);
  }

  throw error;
}

async function loadConversationMemory({
  supabase,
  identity = {},
  platform = 'ELANVISUAL',
  limit = DEFAULT_HISTORY_LIMIT,
  readOnly = false
} = {}) {
  if (isOwnerIdentity(identity)) {
    return {
      enabled: false,
      status: 'OWNER_EXCLUDED',
      conversationId: null,
      history: []
    };
  }

  const resolvedSupabase =
    supabase === undefined
      ? await getDefaultSupabase()
      : supabase;

  if (!resolvedSupabase) {
    return {
      enabled: false,
      status: 'SUPABASE_NOT_CONFIGURED',
      conversationId: null,
      history: []
    };
  }

  const externalConversationId = buildExternalConversationId({
    channel: 'whatsapp',
    platform,
    externalUserId: identity.canonicalId
  });

  if (!externalConversationId) {
    return {
      enabled: false,
      status: 'IDENTITY_REQUIRED',
      conversationId: null,
      history: []
    };
  }

  try {
    const crmIdentity = await ensureIdentity(resolvedSupabase, identity, readOnly);

    if (!crmIdentity?.id) {
      return {
        enabled: false,
        status: readOnly ? 'READ_ONLY_CONVERSATION_NOT_FOUND' : 'IDENTITY_NOT_AVAILABLE',
        conversationId: null,
        history: []
      };
    }

    const conversation = await ensureConversation({
      supabase: resolvedSupabase,
      identityId: crmIdentity.id,
      platform,
      externalConversationId,
      readOnly
    });

    if (!conversation?.id) {
      return {
        enabled: false,
        status: readOnly ? 'READ_ONLY_CONVERSATION_NOT_FOUND' : 'CONVERSATION_NOT_AVAILABLE',
        conversationId: null,
        history: []
      };
    }

    const { data, error } = await resolvedSupabase
      .from('crm_messages')
      .select('direction,body,created_at')
      .eq('conversation_id', conversation.id)
      .in('direction', ['inbound', 'outbound'])
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Number(limit) || DEFAULT_HISTORY_LIMIT));

    if (error) throw error;

    return {
      enabled: true,
      status: 'READY',
      conversationId: conversation.id,
      externalConversationId,
      history: normalizeHistoryRows(data || [], limit)
    };
  } catch (error) {
    return {
      enabled: false,
      status: 'MEMORY_READ_FAILED',
      conversationId: null,
      history: [],
      errorCode: normalize(error?.code || error?.name || 'UNKNOWN_ERROR')
    };
  }
}

async function recordConversationExchange({
  supabase,
  memory = {},
  incomingMessageId,
  userMessage,
  assistantMessage,
  messageType = 'text'
} = {}) {
  const resolvedSupabase =
    supabase === undefined
      ? await getDefaultSupabase()
      : supabase;
  const conversationId = normalize(memory.conversationId);
  const inboundBody = normalize(userMessage).slice(0, MAX_MESSAGE_LENGTH);
  const outboundBody = normalize(assistantMessage).slice(0, MAX_MESSAGE_LENGTH);

  if (!resolvedSupabase || !memory.enabled || !conversationId) {
    return { ok: false, status: 'MEMORY_DISABLED' };
  }

  if (!inboundBody || !outboundBody) {
    return { ok: false, status: 'MESSAGE_REQUIRED' };
  }

  const sourceMessageId = normalize(incomingMessageId).slice(0, 180);
  const inboundId = sourceMessageId || `waha-in:${randomUUID()}`;
  const outboundId = sourceMessageId
    ? `${sourceMessageId}:reply`
    : `waha-out:${randomUUID()}`;
  const now = new Date().toISOString();

  try {
    const { error } = await resolvedSupabase
      .from('crm_messages')
      .upsert(
        [
          {
            conversation_id: conversationId,
            external_message_id: inboundId,
            direction: 'inbound',
            body: inboundBody,
            message_type: messageType,
            status: 'received',
            metadata: { source: 'waha' }
          },
          {
            conversation_id: conversationId,
            external_message_id: outboundId,
            direction: 'outbound',
            body: outboundBody,
            message_type: messageType,
            status: 'sent',
            metadata: { source: 'elankav-orchestrator' }
          }
        ],
        {
          onConflict: 'conversation_id,external_message_id',
          ignoreDuplicates: true
        }
      );

    if (error) throw error;

    const { error: updateError } = await resolvedSupabase
      .from('crm_conversations')
      .update({
        last_message_at: now,
        updated_at: now
      })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    return { ok: true, status: 'SAVED', conversationId };
  } catch (error) {
    return {
      ok: false,
      status: 'MEMORY_WRITE_FAILED',
      conversationId,
      errorCode: normalize(error?.code || error?.name || 'UNKNOWN_ERROR')
    };
  }
}

export {
  DEFAULT_HISTORY_LIMIT,
  MAX_MESSAGE_LENGTH,
  buildExternalConversationId,
  isOwnerIdentity,
  loadConversationMemory,
  normalizeHistoryRows,
  recordConversationExchange
};
