import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSupplierQuery,
  countSuppliers,
  listSuppliers,
  mapSupplier
} from '../api/crm-suppliers.js';

test('buildSupplierQuery always scopes active suppliers', () => {
  const query = new URLSearchParams(buildSupplierQuery({ q: 'Vargas', limit: 10, offset: 20 }));
  assert.equal(query.get('entity_type'), 'eq.supplier');
  assert.equal(query.get('status'), 'eq.active');
  assert.equal(query.get('limit'), '10');
  assert.equal(query.get('offset'), '20');
  assert.match(query.get('or'), /display_name\.ilike/);
});

test('mapSupplier exposes stable CRM contract', () => {
  assert.deepEqual(
    mapSupplier({
      id: 'supplier-1',
      canonical_id: 'supplier:vargas',
      display_name: 'Vargas Centro',
      status: 'active',
      metadata: {
        phone: '+50578828089',
        email: 'ventas@example.com',
        country: 'Nicaragua',
        city: 'Managua'
      },
      created_at: '2026-07-21T00:00:00Z'
    }),
    {
      supplierId: 'supplier-1',
      canonicalId: 'supplier:vargas',
      name: 'Vargas Centro',
      status: 'active',
      phone: '+50578828089',
      email: 'ventas@example.com',
      country: 'Nicaragua',
      city: 'Managua',
      notes: '',
      createdAt: '2026-07-21T00:00:00Z'
    }
  );
});

test('countSuppliers uses exact PostgREST count', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: { get: (name) => name === 'content-range' ? '0-0/37' : null },
    json: async () => [{ id: 'one' }]
  });

  const count = await countSuppliers({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' },
    fetchImpl
  });
  assert.equal(count, 37);
});

test('listSuppliers returns pagination without loading all CRM identities', async () => {
  let requestedUrl = '';
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      headers: { get: () => '0-0/1' },
      json: async () => [{
        id: 'supplier-1',
        canonical_id: 'supplier:vargas',
        display_name: 'Vargas Centro',
        status: 'active',
        metadata: {},
        created_at: '2026-07-21T00:00:00Z'
      }]
    };
  };

  const result = await listSuppliers(
    { q: 'Vargas', limit: 12, offset: 0 },
    {
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' },
      fetchImpl
    }
  );

  assert.match(requestedUrl, /entity_type=eq\.supplier/);
  assert.match(requestedUrl, /limit=12/);
  assert.equal(result.total, 1);
  assert.equal(result.suppliers[0].name, 'Vargas Centro');
});
