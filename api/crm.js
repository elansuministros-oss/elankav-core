import { randomUUID } from 'node:crypto';

import {
  buildIdentityMetadata,
  normalizeEmail,
  normalizeKey,
  normalizePhone,
  normalizeText,
  validateClientInput,
  validateSupplierInput
} from '../lib/crm-domain.js';

const CRM_TABLES = {
  identities: {
    table: 'crm_identities',
    select: 'id,canonical_id,display_name,entity_type,status,metadata,created_at'
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
  return normalizeText(value);
}

function getBearerToken(req) {
  const header = normalize(req.headers?.authorization);
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return normalize(header.slice(7));
}

function requireAdmin(req) {
  const receivedToken = getBearerToken(req);
  const acceptedTokens = [
    normalize(process.env.KAVTORE_SESSION_TOKEN),
    normalize(process.env.CRM_INTERNAL_TOKEN)
  ].filter(Boolean);

  if (!acceptedTokens.length) {
    return { ok: false, status: 500, error: 'CRM_ADMIN_TOKEN_NOT_CONFIGURED' };
  }

  if (!receivedToken || !acceptedTokens.includes(receivedToken)) {
    return { ok: false, status: 401, error: 'CRM_UNAUTHORIZED' };
  }

  return { ok: true };
}

function getSupabaseConfig() {
  const url = normalize(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const key = normalize(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );

  if (!url || !key) throw new Error('CRM_SUPABASE_SERVER_CONFIG_MISSING');
  return { url, key };
}

async function supabaseRequest(
  table,
  { method = 'GET', query = '', body, prefer } = {}
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
        Prefer: prefer || 'return=representation'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `CRM_SUPABASE_HTTP_${response.status}`
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
    version: 'CRM-042B',
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

function buildCanonicalId(entityType, displayName, providedCanonicalId = '') {
  return (
    normalize(providedCanonicalId) ||
    `${entityType}:${normalizeKey(displayName) || 'identity'}:${randomUUID()}`
  );
}

async function createIdentity(input) {
  const displayName = normalize(input?.displayName);
  const canonicalId = normalize(input?.canonicalId);
  const entityType = normalize(input?.entityType) || 'client';

  if (!displayName || !canonicalId) {
    return { ok: false, statusCode: 400, error: 'CRM_IDENTITY_INPUT_INVALID' };
  }

  const rows = await supabaseRequest('crm_identities', {
    method: 'POST',
    body: {
      canonical_id: canonicalId,
      display_name: displayName,
      entity_type: entityType,
      metadata: { source: 'crm-ui-validation' }
    }
  });

  return {
    ok: true,
    statusCode: 201,
    status: 'READY',
    identity: rows?.[0] || null
  };
}

async function listIdentitiesByType(entityType) {
  const query =
    'select=' +
    encodeURIComponent('id,canonical_id,display_name,entity_type,status,metadata') +
    `&entity_type=eq.${encodeURIComponent(entityType)}` +
    '&status=eq.active' +
    '&limit=500';
  const rows = await supabaseRequest('crm_identities', { query });
  return Array.isArray(rows) ? rows : [];
}

async function findIdentityCandidates({ name, phone, email, entityType }) {
  const identities = await listIdentitiesByType(entityType);
  const normalizedName = normalizeKey(name);
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  return identities.filter((identity) => {
    const metadataPhone = normalizePhone(identity.metadata?.phone);
    const metadataEmail = normalizeEmail(identity.metadata?.email);
    const sameName = normalizeKey(identity.display_name) === normalizedName;
    const samePhone = Boolean(
      normalizedPhone && metadataPhone && normalizedPhone === metadataPhone
    );
    const sameEmail = Boolean(
      normalizedEmail && metadataEmail && normalizedEmail === metadataEmail
    );
    return sameName || samePhone || sameEmail;
  });
}

async function ensurePlatformActive(platform) {
  const query =
    'select=' + encodeURIComponent('code,name,active') +
    `&code=eq.${encodeURIComponent(platform)}` +
    '&active=eq.true' +
    '&limit=1';
  const rows = await supabaseRequest('crm_platforms', { query });
  return rows?.[0] || null;
}

async function ensureResponsibleIdentity(identityId) {
  const query =
    'select=' + encodeURIComponent('id,display_name,status') +
    `&id=eq.${encodeURIComponent(identityId)}` +
    '&status=eq.active' +
    '&limit=1';
  const rows = await supabaseRequest('crm_identities', { query });
  return rows?.[0] || null;
}

async function insertRole(identityId, role, platform = null) {
  const rows = await supabaseRequest('crm_roles', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { identity_id: identityId, role, platform }
  });
  return rows?.[0] || null;
}

async function writeAuditEvent({
  action,
  entityType,
  entityId,
  platform,
  payload
}) {
  await supabaseRequest('crm_audit_events', {
    method: 'POST',
    body: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      platform,
      actor_type: 'internal_token',
      payload: payload || {}
    }
  });
}

async function createSupplier(input) {
  const validation = validateSupplierInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: validation.error,
      details: validation.fields || null
    };
  }

  const supplier = validation.value;
  const candidates = await findIdentityCandidates({
    ...supplier,
    entityType: 'supplier'
  });

  if (candidates.length && !supplier.forceCreate) {
    return {
      ok: false,
      statusCode: 409,
      status: 'DUPLICATE_CANDIDATE',
      error: 'CRM_SUPPLIER_DUPLICATE_CANDIDATE',
      candidates
    };
  }

  const identityRows = await supabaseRequest('crm_identities', {
    method: 'POST',
    body: {
      canonical_id: buildCanonicalId(
        'supplier',
        supplier.name,
        supplier.canonicalId
      ),
      display_name: supplier.name,
      entity_type: 'supplier',
      metadata: buildIdentityMetadata({
        source: 'crm-owner-mode',
        phone: supplier.phone,
        whatsapp: supplier.whatsapp,
        email: supplier.email,
        country: supplier.country,
        city: supplier.city,
        notes: supplier.notes
      })
    }
  });

  const identity = identityRows?.[0];
  if (!identity?.id) throw new Error('CRM_SUPPLIER_IDENTITY_NOT_CREATED');

  const [profileRows, role] = await Promise.all([
    supabaseRequest('crm_supplier_profiles', {
      method: 'POST',
      body: {
        identity_id: identity.id,
        supplier_type: supplier.supplierType,
        categories: supplier.categories,
        contact_name: supplier.contactName || null,
        phone: supplier.phone || null,
        email: supplier.email || null,
        country: supplier.country || null,
        city: supplier.city || null,
        commercial_terms: supplier.commercialTerms || null,
        notes: supplier.notes || null,
        status: 'active'
      }
    }),
    insertRole(identity.id, 'supplier', null)
  ]);

  await writeAuditEvent({
    action: 'create_supplier',
    entityType: 'supplier',
    entityId: identity.id,
    platform: null,
    payload: {
      supplierType: supplier.supplierType,
      categories: supplier.categories
    }
  });

  return {
    ok: true,
    statusCode: 201,
    status: 'CREATED',
    supplier: {
      identity,
      profile: profileRows?.[0] || null,
      role
    }
  };
}

async function findIdentityForClient(client) {
  const candidates = await findIdentityCandidates({
    ...client,
    entityType: 'client'
  });
  return candidates[0] || null;
}

async function findClientRelationship(identityId, platform) {
  const query =
    'select=' +
    encodeURIComponent(
      'id,identity_id,platform,responsible_commercial_id,status,created_at'
    ) +
    `&identity_id=eq.${encodeURIComponent(identityId)}` +
    `&platform=eq.${encodeURIComponent(platform)}` +
    '&limit=1';
  const rows = await supabaseRequest('crm_client_relationships', { query });
  return rows?.[0] || null;
}

async function createClient(input) {
  const validation = validateClientInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: validation.error,
      details: validation.fields || null
    };
  }

  const client = validation.value;
  const platform = await ensurePlatformActive(client.platform);
  if (!platform) {
    return {
      ok: false,
      statusCode: 400,
      error: 'CRM_PLATFORM_INVALID'
    };
  }

  const responsibleCommercialId =
    client.responsibleCommercialId ||
    normalize(process.env.CRM_DEFAULT_ADMIN_IDENTITY_ID);

  if (!responsibleCommercialId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'CRM_CLIENT_RESPONSIBLE_REQUIRED'
    };
  }

  const responsible = await ensureResponsibleIdentity(responsibleCommercialId);
  if (!responsible) {
    return {
      ok: false,
      statusCode: 400,
      error: 'CRM_CLIENT_RESPONSIBLE_INVALID'
    };
  }

  let identity = await findIdentityForClient(client);
  let identityCreated = false;

  if (!identity) {
    const rows = await supabaseRequest('crm_identities', {
      method: 'POST',
      body: {
        canonical_id: buildCanonicalId(
          'client',
          client.name,
          client.canonicalId
        ),
        display_name: client.name,
        entity_type: 'client',
        metadata: buildIdentityMetadata({
          source: 'crm-owner-mode',
          phone: client.phone,
          whatsapp: client.whatsapp,
          email: client.email,
          country: client.country,
          city: client.city,
          notes: client.notes
        })
      }
    });
    identity = rows?.[0] || null;
    identityCreated = true;
  }

  if (!identity?.id) throw new Error('CRM_CLIENT_IDENTITY_NOT_CREATED');

  const existingRelationship = await findClientRelationship(
    identity.id,
    client.platform
  );

  if (existingRelationship) {
    return {
      ok: false,
      statusCode: 409,
      status: 'DUPLICATE_CANDIDATE',
      error: 'CRM_CLIENT_RELATIONSHIP_EXISTS',
      client: { identity, relationship: existingRelationship }
    };
  }

  const [relationshipRows, role] = await Promise.all([
    supabaseRequest('crm_client_relationships', {
      method: 'POST',
      body: {
        identity_id: identity.id,
        platform: client.platform,
        responsible_commercial_id: responsibleCommercialId,
        status: 'active',
        source: 'crm-owner-mode',
        metadata: { notes: client.notes || null }
      }
    }),
    insertRole(identity.id, 'client', client.platform)
  ]);

  await writeAuditEvent({
    action: 'create_client',
    entityType: 'client',
    entityId: identity.id,
    platform: client.platform,
    payload: { responsibleCommercialId, identityCreated }
  });

  return {
    ok: true,
    statusCode: 201,
    status: 'CREATED',
    client: {
      identity,
      identityCreated,
      relationship: relationshipRows?.[0] || null,
      role
    }
  };
}

function sendResult(res, result) {
  if (!result.ok) {
    return res.status(result.statusCode).json({
      ok: false,
      status: result.status || 'ERROR',
      error: result.error,
      details: result.details || null,
      candidates: result.candidates || undefined,
      client: result.client || undefined
    });
  }

  return res.status(result.statusCode).json({
    ok: true,
    status: result.status,
    identity: result.identity,
    supplier: result.supplier,
    client: result.client
  });
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
      return res.status(200).json(await loadDashboard());
    }

    if (req.method === 'POST') {
      const action = normalize(req.body?.action);

      if (action === 'create_identity') {
        return sendResult(res, await createIdentity(req.body));
      }
      if (action === 'create_supplier') {
        return sendResult(res, await createSupplier(req.body));
      }
      if (action === 'create_client') {
        return sendResult(res, await createClient(req.body));
      }

      return res.status(400).json({
        ok: false,
        status: 'ERROR',
        error: 'CRM_ACTION_INVALID'
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
