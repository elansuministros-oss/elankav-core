import {
  createIdentity,
  listConversations,
  listIdentities,
  listMessages
} from '../adapters/crmClientSupabaseAdapter';

function classifyError(error) {
  const message = String(error?.message || error || 'CRM_ERROR');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('supabase_public_config_missing') ||
    normalized.includes('supabase_public_url_invalid') ||
    normalized.includes('supabase_public_key_invalid') ||
    normalized.includes('invalid api key')
  ) {
    return {
      status: 'CONFIG_PENDING',
      message
    };
  }

  if (
    normalized.includes('does not exist') ||
    normalized.includes('could not find the table') ||
    normalized.includes('relation')
  ) {
    return {
      status: 'MIGRATION_PENDING',
      message
    };
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('not allowed')
  ) {
    return {
      status: 'ACCESS_DENIED',
      message
    };
  }

  return {
    status: 'ERROR',
    message
  };
}

async function loadCrmDashboard() {
  try {
    const [identities, conversations, messages] = await Promise.all([
      listIdentities(),
      listConversations(),
      listMessages()
    ]);

    return {
      ok: true,
      status: 'READY',
      version: 'CRM-001J',
      identities,
      conversations,
      messages,
      counts: {
        identities: identities.length,
        conversations: conversations.length,
        messages: messages.length
      }
    };
  } catch (error) {
    const classified = classifyError(error);
    return {
      ok: false,
      status: classified.status,
      error: classified.message,
      identities: [],
      conversations: [],
      messages: [],
      counts: {
        identities: 0,
        conversations: 0,
        messages: 0
      }
    };
  }
}

async function createCrmIdentity(input) {
  try {
    const identity = await createIdentity(input);
    return {
      ok: true,
      status: 'READY',
      identity
    };
  } catch (error) {
    const classified = classifyError(error);
    return {
      ok: false,
      status: classified.status,
      error: classified.message
    };
  }
}

export {
  classifyError,
  createCrmIdentity,
  loadCrmDashboard
};