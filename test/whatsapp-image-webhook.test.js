import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/whatsapp-v2.js';

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('imagen sin caption activa diseño y entrega referencia al Orchestrator', async () => {
  const previous = {
    fetch: globalThis.fetch,
    secret: process.env.MEDIA_REFERENCE_SIGNING_SECRET,
    publicUrl: process.env.CORE_PUBLIC_BASE_URL,
    orchestrator: process.env.ORCHESTRATOR_MESSAGES_URL
  };
  let sentPayload;

  process.env.MEDIA_REFERENCE_SIGNING_SECRET =
    'media01-test-secret-with-at-least-32-characters';
  process.env.CORE_PUBLIC_BASE_URL = 'https://elankav-core.vercel.app';
  process.env.ORCHESTRATOR_MESSAGES_URL =
    'https://orchestrator.test/api/messages';
  globalThis.fetch = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          result: {
            reply: 'Preparé una propuesta visual.',
            context: { platform: 'elanvisual', ownerMode: true }
          }
        };
      }
    };
  };

  try {
    const req = {
      method: 'POST',
      query: { dryRun: '1' },
      body: {
        event: 'message',
        session: 'ELANKAV',
        payload: {
          id: 'IMG-WEBHOOK-001',
          from: '215440458567779@lid',
          type: 'image',
          mimetype: 'image/jpeg',
          body: '',
          media: {
            url: 'http://localhost:3000/api/files/IMG-WEBHOOK-001.jpg'
          }
        }
      }
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.processed, true);
    assert.equal(res.payload.mediaDetected, true);
    assert.match(sentPayload.message, /propuesta visual/i);
    assert.equal(sentPayload.metadata.references.length, 1);
    assert.equal(sentPayload.metadata.references[0].kind, 'image');
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [
      ['MEDIA_REFERENCE_SIGNING_SECRET', previous.secret],
      ['CORE_PUBLIC_BASE_URL', previous.publicUrl],
      ['ORCHESTRATOR_MESSAGES_URL', previous.orchestrator]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
