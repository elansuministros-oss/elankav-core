const SUPPLIER_TYPES = new Set(['materials', 'services', 'mixed']);

export function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizePhone(value) {
  return normalizeText(value).replace(/\D/g, '');
}

export function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertAllowedKeys(input, allowedKeys) {
  const unknown = Object.keys(input || {}).filter(
    (key) => !allowedKeys.includes(key)
  );

  if (unknown.length) {
    return {
      ok: false,
      error: 'CRM_PAYLOAD_FIELDS_INVALID',
      fields: unknown
    };
  }

  return { ok: true };
}

export function validateSupplierInput(input = {}) {
  const allowed = assertAllowedKeys(input, [
    'action',
    'name',
    'supplierType',
    'categories',
    'contactName',
    'phone',
    'email',
    'country',
    'city',
    'commercialTerms',
    'notes',
    'canonicalId',
    'forceCreate'
  ]);

  if (!allowed.ok) return allowed;

  const name = normalizeText(input.name);
  const supplierType = normalizeText(input.supplierType).toLowerCase();
  const categories = Array.isArray(input.categories)
    ? input.categories.map(normalizeText).filter(Boolean)
    : [];

  if (!name || !SUPPLIER_TYPES.has(supplierType)) {
    return {
      ok: false,
      error: 'CRM_SUPPLIER_INPUT_INVALID'
    };
  }

  return {
    ok: true,
    value: {
      name,
      supplierType,
      categories,
      contactName: normalizeText(input.contactName),
      phone: normalizePhone(input.phone),
      email: normalizeEmail(input.email),
      country: normalizeText(input.country),
      city: normalizeText(input.city),
      commercialTerms: normalizeText(input.commercialTerms),
      notes: normalizeText(input.notes),
      canonicalId: normalizeText(input.canonicalId),
      forceCreate: input.forceCreate === true
    }
  };
}

export function validateClientInput(input = {}) {
  const allowed = assertAllowedKeys(input, [
    'action',
    'name',
    'platform',
    'responsibleCommercialId',
    'phone',
    'email',
    'country',
    'city',
    'notes',
    'canonicalId'
  ]);

  if (!allowed.ok) return allowed;

  const name = normalizeText(input.name);
  const platform = normalizeKey(input.platform);
  const responsibleCommercialId = normalizeText(
    input.responsibleCommercialId
  );

  if (!name || !platform) {
    return {
      ok: false,
      error: 'CRM_CLIENT_INPUT_INVALID'
    };
  }

  return {
    ok: true,
    value: {
      name,
      platform,
      responsibleCommercialId,
      phone: normalizePhone(input.phone),
      email: normalizeEmail(input.email),
      country: normalizeText(input.country),
      city: normalizeText(input.city),
      notes: normalizeText(input.notes),
      canonicalId: normalizeText(input.canonicalId)
    }
  };
}

export function buildIdentityMetadata({ source, phone, email, country, city, notes }) {
  return Object.fromEntries(
    Object.entries({ source, phone, email, country, city, notes }).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null
    )
  );
}
