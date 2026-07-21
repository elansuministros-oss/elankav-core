import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/crm.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('CRM-101A extends the dashboard contract without removing legacy fields', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    KAVTORE_SESSION_TOKEN: process.env.KAVTORE_SESSION_TOKEN,
    CRM_INTERNAL_TOKEN: process.env.CRM_INTERNAL_TOKEN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
  };

  process.env.KAVTORE_SESSION_TOKEN = 'test-token';
  delete process.env.CRM_INTERNAL_TOKEN;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
  delete process.env.SUPABASE_SERVICE_KEY;

  const fixtures = {
    crm_identities: [{ id: 'identity-1', display_name: 'Cliente Uno' }],
    crm_conversations: [{ id: 'conversation-1', identity_id: 'identity-1' }],
    crm_messages: [{ id: 'message-1', conversation_id: 'conversation-1' }],
    crm_roles: [
      {
        id: 'role-1',
        identity_id: 'identity-1',
        role: 'client',
        platform: 'elanvisual'
      }
    ],
    crm_client_relationships: [
      {
        id: 'relationship-1',
        identity_id: 'identity-1',
        platform: 'elanvisual',
        status: 'active'
      }
    ]
  };

  const requestedUrls = [];

  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    const table = Object.keys(fixtures).find((name) =>
      String(url).includes(`/rest/v1/${name}?`)
    );

    assert.ok(table, `Unexpected Supabase table request: ${url}`);

    return {
      ok: true,
      status: 200,
      async json() {
        return fixtures[table];
      }
    };
  };

  try {
    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer test-token' }
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, 'READY');
    assert.equal(res.body.version, 'CRM-101A');

    assert.deepEqual(res.body.identities, fixtures.crm_identities);
    assert.deepEqual(res.body.conversations, fixtures.crm_conversations);
    assert.deepEqual(res.body.messages, fixtures.crm_messages);
    assert.deepEqual(res.body.roles, fixtures.crm_roles);
    assert.deepEqual(
      res.body.relationships,
      fixtures.crm_client_relationships
    );

    assert.deepEqual(res.body.counts, {
      identities: 1,
      conversations: 1,
      messages: 1,
      roles: 1,
      relationships: 1
    });

    const rolesRequest = requestedUrls.find((url) =>
      url.includes('/rest/v1/crm_roles?')
    );
    assert.ok(rolesRequest);
    assert.equal(
      rolesRequest.includes('order='),
      false,
      'crm_roles must not assume an unverified created_at column'
    );

    assert.equal(requestedUrls.length, 5);
  } finally {
    global.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
