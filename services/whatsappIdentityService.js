const BOOTSTRAP_IDENTITIES = Object.freeze({
  '215440458567779': Object.freeze({
    canonicalId: '50588388940',
    name: 'Erick Cano',
    entityType: 'owner',
    roles: Object.freeze(['owner'])
  })
});

function normalizeExternalId(value) {
  return String(value || '')
    .split('@')[0]
    .replace(/\D/g, '');
}

function normalizeIdentityRecord(value) {
  if (typeof value === 'string') {
    const canonicalId = normalizeExternalId(value);
    return canonicalId
      ? {
          canonicalId,
          name: null,
          entityType: 'unknown',
          roles: []
        }
      : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const canonicalId = normalizeExternalId(
    value.canonicalId || value.phone || value.externalUserId
  );

  if (!canonicalId) {
    return null;
  }

  return {
    canonicalId,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : null,
    entityType:
      typeof value.entityType === 'string' && value.entityType.trim()
        ? value.entityType.trim().toLowerCase()
        : 'unknown',
    roles: Array.isArray(value.roles)
      ? value.roles
          .map(role => String(role || '').trim().toLowerCase())
          .filter(Boolean)
      : []
  };
}

function readEnvironmentIdentities() {
  const raw = String(
    process.env.ELANKAV_WHATSAPP_IDENTITIES_JSON || ''
  ).trim();

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([alias, value]) => [
          normalizeExternalId(alias),
          normalizeIdentityRecord(value)
        ])
        .filter(([alias, value]) => alias && value)
    );
  } catch {
    return {};
  }
}

function resolveWhatsAppIdentity({ senderRaw, phone } = {}) {
  const receivedId = normalizeExternalId(senderRaw || phone);
  const environmentIdentities = readEnvironmentIdentities();
  const record =
    environmentIdentities[receivedId] ||
    BOOTSTRAP_IDENTITIES[receivedId] ||
    null;

  if (!receivedId) {
    return Object.freeze({
      receivedId: null,
      canonicalId: null,
      name: null,
      entityType: 'unknown',
      roles: Object.freeze([]),
      matched: false,
      source: 'empty'
    });
  }

  if (!record) {
    return Object.freeze({
      receivedId,
      canonicalId: receivedId,
      name: null,
      entityType: 'unknown',
      roles: Object.freeze([]),
      matched: false,
      source: 'direct'
    });
  }

  return Object.freeze({
    receivedId,
    canonicalId: record.canonicalId,
    name: record.name,
    entityType: record.entityType,
    roles: Object.freeze([...record.roles]),
    matched: record.canonicalId !== receivedId,
    source: environmentIdentities[receivedId]
      ? 'environment'
      : 'bootstrap'
  });
}

export {
  BOOTSTRAP_IDENTITIES,
  normalizeExternalId,
  resolveWhatsAppIdentity
};
