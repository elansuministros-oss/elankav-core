import { normalizeText, validateContactInput } from './crm-domain.js';

export async function createContact({ input, supabaseRequest, writeAuditEvent }) {
  const validation = validateContactInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: validation.error,
      details: validation.fields || null
    };
  }

  const contact = validation.value;

  const identityRows = await supabaseRequest('crm_identities', {
    query:
      'select=' + encodeURIComponent('id,display_name,status') +
      `&id=eq.${encodeURIComponent(contact.identityId)}` +
      '&status=eq.active&limit=1'
  });

  if (!identityRows?.[0]) {
    return { ok: false, statusCode: 404, error: 'CRM_CONTACT_IDENTITY_NOT_FOUND' };
  }

  if (contact.isPrimary) {
    await supabaseRequest('crm_contacts', {
      method: 'PATCH',
      query: `identity_id=eq.${encodeURIComponent(contact.identityId)}&is_primary=eq.true`,
      body: { is_primary: false, updated_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
  }

  const rows = await supabaseRequest('crm_contacts', {
    method: 'POST',
    body: {
      identity_id: contact.identityId,
      contact_name: contact.contactName || null,
      role_or_area: contact.contactRole || null,
      whatsapp: contact.whatsapp,
      phone: contact.phone || null,
      email: contact.email || null,
      country: contact.country || null,
      city: contact.city || null,
      address: contact.address || null,
      notes: contact.notes || null,
      is_primary: contact.isPrimary,
      status: 'active'
    }
  });

  const created = rows?.[0] || null;
  if (!created?.id) throw new Error('CRM_CONTACT_NOT_CREATED');

  await writeAuditEvent({
    action: 'add_contact',
    entityType: 'contact',
    entityId: created.id,
    platform: null,
    payload: { identityId: contact.identityId, whatsapp: contact.whatsapp }
  });

  return { ok: true, statusCode: 201, status: 'CREATED', contact: created };
}

export async function editContact({ input, supabaseRequest, writeAuditEvent }) {
  const validation = validateContactInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: validation.error,
      details: validation.fields || null
    };
  }

  const contact = validation.value;
  if (!contact.contactId) {
    return { ok: false, statusCode: 400, error: 'CRM_CONTACT_ID_REQUIRED' };
  }

  const existingRows = await supabaseRequest('crm_contacts', {
    query:
      'select=' + encodeURIComponent('id,identity_id,status') +
      `&id=eq.${encodeURIComponent(contact.contactId)}` +
      `&identity_id=eq.${encodeURIComponent(contact.identityId)}` +
      '&status=eq.active&limit=1'
  });

  if (!existingRows?.[0]) {
    return { ok: false, statusCode: 404, error: 'CRM_CONTACT_NOT_FOUND' };
  }

  if (contact.isPrimary) {
    await supabaseRequest('crm_contacts', {
      method: 'PATCH',
      query: `identity_id=eq.${encodeURIComponent(contact.identityId)}&is_primary=eq.true`,
      body: { is_primary: false, updated_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
  }

  const rows = await supabaseRequest('crm_contacts', {
    method: 'PATCH',
    query: `id=eq.${encodeURIComponent(contact.contactId)}`,
    body: {
      contact_name: contact.contactName || null,
      role_or_area: contact.contactRole || null,
      whatsapp: contact.whatsapp,
      phone: contact.phone || null,
      email: contact.email || null,
      country: contact.country || null,
      city: contact.city || null,
      address: contact.address || null,
      notes: contact.notes || null,
      is_primary: contact.isPrimary,
      updated_at: new Date().toISOString()
    }
  });

  const updated = rows?.[0] || null;
  if (!updated?.id) throw new Error('CRM_CONTACT_NOT_UPDATED');

  await writeAuditEvent({
    action: 'update_contact',
    entityType: 'contact',
    entityId: updated.id,
    platform: null,
    payload: { identityId: contact.identityId, whatsapp: contact.whatsapp }
  });

  return { ok: true, statusCode: 200, status: 'UPDATED', contact: updated };
}

export function buildPrimaryContactInput(identityId, source = {}) {
  return {
    identityId: normalizeText(identityId),
    contactName: source.contactName,
    contactRole: source.contactRole,
    whatsapp: source.whatsapp || source.phone,
    phone: source.phone,
    email: source.email,
    country: source.country,
    city: source.city,
    address: source.address,
    notes: source.notes,
    isPrimary: true
  };
}
