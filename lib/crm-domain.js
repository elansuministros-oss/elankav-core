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

export function normalizeWhatsappE164(value, defaultCountryCode = '505') {
  const raw = normalizeText(value);
  if (!raw) return '';

  const compact = raw.replace(/[\s().-]/g, '');
  let digits = compact.replace(/\D/g, '');

  if (compact.startsWith('00')) {
    digits = compact.slice(2).replace(/\D/g, '');
  } else if (!compact.startsWith('+')) {
    if (digits.length === 8) {
      digits = `${defaultCountryCode}${digits}`;
    } else if (!/^[1-9]\d{8,14}$/.test(digits)) {
      return '';
    }
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return '';
  return `+${digits}`;
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
    'action', 'name', 'supplierType', 'categories', 'contactName',
    'contactRole', 'whatsapp', 'phone', 'email', 'country', 'city',
    'address', 'commercialTerms', 'notes', 'canonicalId', 'forceCreate'
  ]);

  if (!allowed.ok) return allowed;

  const name = normalizeText(input.name);
  const supplierType = normalizeText(input.supplierType).toLowerCase();
  const categories = Array.isArray(input.categories)
    ? input.categories.map(normalizeText).filter(Boolean)
    : [];
  const whatsapp = normalizeWhatsappE164(input.whatsapp || input.phone);

  if (!name || !SUPPLIER_TYPES.has(supplierType)) {
    return { ok: false, error: 'CRM_SUPPLIER_INPUT_INVALID' };
  }
  if (!whatsapp) {
    return { ok: false, error: 'CRM_SUPPLIER_WHATSAPP_INVALID' };
  }

  return {
    ok: true,
    value: {
      name,
      supplierType,
      categories,
      contactName: normalizeText(input.contactName),
      contactRole: normalizeText(input.contactRole),
      whatsapp,
      phone: normalizePhone(input.phone || whatsapp),
      email: normalizeEmail(input.email),
      country: normalizeText(input.country),
      city: normalizeText(input.city),
      address: normalizeText(input.address),
      commercialTerms: normalizeText(input.commercialTerms),
      notes: normalizeText(input.notes),
      canonicalId: normalizeText(input.canonicalId),
      forceCreate: input.forceCreate === true
    }
  };
}

export function validateClientInput(input = {}) {
  const allowed = assertAllowedKeys(input, [
    'action', 'name', 'platform', 'responsibleCommercialId', 'contactName',
    'contactRole', 'whatsapp', 'phone', 'email', 'country', 'city',
    'address', 'notes', 'canonicalId'
  ]);

  if (!allowed.ok) return allowed;

  const name = normalizeText(input.name);
  const platform = normalizeKey(input.platform);
  const responsibleCommercialId = normalizeText(input.responsibleCommercialId);
  const whatsapp = normalizeWhatsappE164(input.whatsapp || input.phone);

  if (!name || !platform) {
    return { ok: false, error: 'CRM_CLIENT_INPUT_INVALID' };
  }
  if (!whatsapp) {
    return { ok: false, error: 'CRM_CLIENT_WHATSAPP_INVALID' };
  }

  return {
    ok: true,
    value: {
      name,
      platform,
      responsibleCommercialId,
      contactName: normalizeText(input.contactName),
      contactRole: normalizeText(input.contactRole),
      whatsapp,
      phone: normalizePhone(input.phone || whatsapp),
      email: normalizeEmail(input.email),
      country: normalizeText(input.country),
      city: normalizeText(input.city),
      address: normalizeText(input.address),
      notes: normalizeText(input.notes),
      canonicalId: normalizeText(input.canonicalId)
    }
  };
}

export function validateContactInput(input = {}) {
  const allowed = assertAllowedKeys(input, [
    'action', 'identityId', 'contactId', 'contactName', 'contactRole',
    'whatsapp', 'phone', 'email', 'country', 'city', 'address', 'notes',
    'isPrimary'
  ]);

  if (!allowed.ok) return allowed;

  const identityId = normalizeText(input.identityId);
  const whatsapp = normalizeWhatsappE164(input.whatsapp);

  if (!identityId) return { ok: false, error: 'CRM_CONTACT_IDENTITY_REQUIRED' };
  if (!whatsapp) return { ok: false, error: 'CRM_CONTACT_WHATSAPP_INVALID' };

  return {
    ok: true,
    value: {
      identityId,
      contactId: normalizeText(input.contactId),
      contactName: normalizeText(input.contactName),
      contactRole: normalizeText(input.contactRole),
      whatsapp,
      phone: normalizePhone(input.phone),
      email: normalizeEmail(input.email),
      country: normalizeText(input.country),
      city: normalizeText(input.city),
      address: normalizeText(input.address),
      notes: normalizeText(input.notes),
      isPrimary: input.isPrimary === true
    }
  };
}

export function buildIdentityMetadata({ source, phone, whatsapp, email, country, city, address, notes }) {
  return Object.fromEntries(
    Object.entries({ source, phone, whatsapp, email, country, city, address, notes }).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null
    )
  );
}
