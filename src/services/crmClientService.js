import {
  createIdentity,
  loadDashboard
} from '../adapters/crmClientSupabaseAdapter';

function classifyError(error) {
  const message = String(error?.message || error || 'CRM_ERROR');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('crm_admin_token_missing') ||
    normalized.includes('crm_unauthorized')
  ) {
    return {
      status: 'ACCESS_DENIED',
      message
    };
  }

  if (
    normalized.includes('crm_supabase_server_config_missing') ||
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
    status: error?.status || 'ERROR',
    message
  };
}

async function loadCrmDashboard(authToken) {
  try {
    return await loadDashboard(authToken);
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

async function createCrmIdentity(input, authToken) {
  try {
    const identity = await createIdentity(input, authToken);

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
