import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeCrmRequest,
  buildSupabaseHeaders,
  parseExactCount
} from '../lib/crm-server-adapter.js';

test('authorizeCrmRequest accepts configured internal token', () => {
  const result = authorizeCrmRequest(
    { headers: { authorization: 'Bearer internal-secret' } },
    { CRM_INTERNAL_TOKEN: 'internal-secret' }
  );
  assert.deepEqual(result, { ok: true });
});

test('authorizeCrmRequest rejects invalid token', () => {
  const result = authorizeCrmRequest(
    { headers: { authorization: 'Bearer wrong' } },
    { CRM_INTERNAL_TOKEN: 'internal-secret' }
  );
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 401);
  assert.equal(result.error, 'CRM_UNAUTHORIZED');
});

test('modern Supabase secret does not receive Authorization bearer header', () => {
  const headers = buildSupabaseHeaders('sb_secret_example', { count: true });
  assert.equal(headers.apikey, 'sb_secret_example');
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.Prefer, 'count=exact');
});

test('legacy service role keeps Authorization bearer header', () => {
  const headers = buildSupabaseHeaders('legacy-jwt');
  assert.equal(headers.Authorization, 'Bearer legacy-jwt');
});

test('parseExactCount reads PostgREST content-range total', () => {
  assert.equal(parseExactCount('0-0/128'), 128);
  assert.equal(parseExactCount('*/0'), 0);
  assert.equal(parseExactCount(''), null);
});
