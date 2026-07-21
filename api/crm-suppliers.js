import { normalizeKey, normalizeText } from '../lib/crm-domain.js';
import {
  authorizeCrmRequest,
  crmSupabaseRequest
} from '../lib/crm-server-adapter.js';

const clean = (value) => normalizeText(value);

function clampLimit(value) {
  return Math.min(Math.max(Number.parseInt(value, 10) || 25, 1), 100);
}

function clampOffset(value) {
  return Math.max(Number.parseInt(value, 10) || 0, 0);
}

function supplierSelect() {
  return 'id,canonical_id,display_name,entity_type,status,metadata,created_at';
}

function buildSupplierQuery({ q = '', limit = 25, offset = 0, id = '' } = {}) {
  const params = new URLSearchParams();
  params.set('select', supplierSelect());
  params.set('entity_type', 'eq.supplier');
  params.set('status', 'eq.active');

  if (id) {
    params.set('id', `eq.${id}`);
    params.set('limit', '1');
    return params.toString();
  }

  const normalizedQuery = normalizeKey(q);
  if (normalizedQuery) {
    const escaped = normalizedQuery.replace(/[,*()]/g, '');
    params.set(
      'or',
      `(display_name.ilike.*${escaped}*,canonical_id.ilike.*${escaped}*)`
    );
  }

  params.set('order', 'display_name.asc');
  params.set('limit', String(clampLimit(limit)));
  params.set('offset', String(clampOffset(offset)));
  return params.toString();
}

function mapSupplier(identity) {
  return {
    supplierId: identity.id,
    canonicalId: identity.canonical_id,
    name: identity.display_name,
    status: identity.status,
    phone: clean(identity.metadata?.phone),
    email: clean(identity.metadata?.email),
    country: clean(identity.metadata?.country),
    city: clean(identity.metadata?.city),
    notes: clean(identity.metadata?.notes),
    createdAt: identity.created_at
  };
}

async function countSuppliers(options = {}) {
  const query = new URLSearchParams({
    select: 'id',
    entity_type: 'eq.supplier',
    status: 'eq.active',
    limit: '1'
  }).toString();

  const result = await crmSupabaseRequest('crm_identities', {
    query,
    count: true,
    ...options
  });

  return Number.isInteger(result.count)
    ? result.count
    : Array.isArray(result.data)
      ? result.data.length
      : 0;
}

async function listSuppliers(input = {}, options = {}) {
  const result = await crmSupabaseRequest('crm_identities', {
    query: buildSupplierQuery(input),
    count: true,
    ...options
  });

  return {
    suppliers: Array.isArray(result.data) ? result.data.map(mapSupplier) : [],
    total: Number.isInteger(result.count) ? result.count : 0,
    limit: clampLimit(input.limit),
    offset: clampOffset(input.offset)
  };
}

async function getSupplier(id, options = {}) {
  const result = await crmSupabaseRequest('crm_identities', {
    query: buildSupplierQuery({ id }),
    ...options
  });
  const identity = Array.isArray(result.data) ? result.data[0] : null;
  return identity ? mapSupplier(identity) : null;
}

export default async function handler(req, res) {
  const authorization = authorizeCrmRequest(req);
  if (!authorization.ok) {
    return res.status(authorization.statusCode).json({
      ok: false,
      status: 'ACCESS_DENIED',
      error: authorization.error
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      status: 'ERROR',
      error: 'CRM_METHOD_NOT_ALLOWED'
    });
  }

  const action = clean(req.query?.action || 'list').toLowerCase();

  try {
    if (action === 'count') {
      return res.status(200).json({
        ok: true,
        status: 'READY',
        count: await countSuppliers()
      });
    }

    if (action === 'get') {
      const id = clean(req.query?.id);
      if (!id) {
        return res.status(422).json({
          ok: false,
          status: 'ERROR',
          error: 'CRM_SUPPLIER_ID_REQUIRED'
        });
      }

      const supplier = await getSupplier(id);
      if (!supplier) {
        return res.status(404).json({
          ok: false,
          status: 'NOT_FOUND',
          error: 'CRM_SUPPLIER_NOT_FOUND'
        });
      }

      return res.status(200).json({ ok: true, status: 'READY', supplier });
    }

    if (action === 'list' || action === 'search') {
      const result = await listSuppliers({
        q: clean(req.query?.q),
        limit: req.query?.limit,
        offset: req.query?.offset
      });
      return res.status(200).json({ ok: true, status: 'READY', ...result });
    }

    return res.status(400).json({
      ok: false,
      status: 'ERROR',
      error: 'CRM_SUPPLIER_ACTION_INVALID'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      status: 'ERROR',
      error: String(error?.message || 'CRM_SUPPLIER_QUERY_ERROR'),
      details: error?.details || null
    });
  }
}

export {
  buildSupplierQuery,
  countSuppliers,
  getSupplier,
  listSuppliers,
  mapSupplier
};
