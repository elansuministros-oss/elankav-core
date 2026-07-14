import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createCanvas } from '@napi-rs/canvas';

import handler from '../api/whatsapp-v2.js';

const ASSET_ID =
  '77777777-7777-4777-8777-777777777777';

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

function requestBody() {
  return {
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: { id: 'DESIGN-WEBHOOK-001' },
      from: '50500000000@c.us',
      type: 'chat',
      body: 'Generá una propuesta visual para mi negocio'
    }
  };
}

function orchestratorPayload(approved = true) {
  return {
    result: {
      reply: 'Preparé una propuesta visual para tu proyecto.',
      context: {
        ownerMode: false,
        platform: 'ELANVISUAL'
      },
      design: {
        designId: ASSET_ID,
        status: 'PROCESSED',
        clientReady: true,
        conversational: false,
        assets: [{
          id: ASSET_ID,
          type: 'IMAGE',
          mimeType: 'image/png',
          platform: 'ELANVISUAL',
          url:
            `https://orchestrator.elankav.com/api/design-assets/${ASSET_ID}`
        }],
        qa: { approved }
      }
    }
  };
}

async function withDeliveryEnvironment(callback) {
  const names = [
    'ORCHESTRATOR_MESSAGES_URL',
    'WAHA_BASE_URL',
    'WAHA_API_KEY',
    'WAHA_API_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const previous = Object.fromEntries(
    names.map(name => [name, globalThis.process.env[name]])
  );
  const previousFetch = globalThis.fetch;

  globalThis.process.env.ORCHESTRATOR_MESSAGES_URL =
    'https://orchestrator.test/api/messages';
  globalThis.process.env.WAHA_BASE_URL = 'https://waha.test';
  globalThis.process.env.WAHA_API_KEY = 'test-key';
  delete globalThis.process.env.WAHA_API_TOKEN;
  delete globalThis.process.env.SUPABASE_URL;
  delete globalThis.process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    await callback();
  } finally {
    globalThis.fetch = previousFetch;

    for (const name of names) {
      if (previous[name] === undefined) {
        delete globalThis.process.env[name];
      } else {
        globalThis.process.env[name] = previous[name];
      }
    }
  }
}

test('WhatsApp entrega el diseño aprobado como JPEG y no duplica texto', async () => {
  await withDeliveryEnvironment(async () => {
    const canvas = createCanvas(2, 2);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 2, 2);
    const png = await canvas.encode('png');
    const wahaCalls = [];

    globalThis.fetch = async (url, options = {}) => {
      if (url === 'https://orchestrator.test/api/messages') {
        return new Response(
          JSON.stringify(orchestratorPayload(true)),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }

      if (
        url ===
        `https://orchestrator.elankav.com/api/design-assets/${ASSET_ID}`
      ) {
        return new Response(png, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': String(png.length)
          }
        });
      }

      if (String(url).startsWith('https://waha.test/api/')) {
        wahaCalls.push({
          url,
          body: JSON.parse(options.body)
        });

        return new Response(
          JSON.stringify({ id: { id: 'IMAGE-WAHA-001' } }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const res = createResponse();
    await handler(
      {
        method: 'POST',
        body: requestBody(),
        query: {}
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.replySent, true);
    assert.equal(res.payload.design.sent, true);
    assert.equal(res.payload.design.status, 'DESIGN_IMAGE_DELIVERED');
    assert.equal(wahaCalls.length, 1);
    assert.equal(wahaCalls[0].url, 'https://waha.test/api/sendImage');
    assert.equal(wahaCalls[0].body.file.mimetype, 'image/jpeg');
    assert.equal(wahaCalls[0].body.caption, 'Preparé una propuesta visual para tu proyecto.');

    const delivered = Buffer.from(
      wahaCalls[0].body.file.data,
      'base64'
    );
    assert.equal(delivered.subarray(0, 3).toString('hex'), 'ffd8ff');
  });
});

test('WhatsApp bloquea imagen sin QA y conserva respuesta de texto', async () => {
  await withDeliveryEnvironment(async () => {
    const calls = [];

    globalThis.fetch = async (url, options = {}) => {
      calls.push(String(url));

      if (url === 'https://orchestrator.test/api/messages') {
        return new Response(
          JSON.stringify(orchestratorPayload(false)),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }

      if (url === 'https://waha.test/api/sendText') {
        const body = JSON.parse(options.body);
        assert.equal(
          body.text,
          'Preparé una propuesta visual para tu proyecto.'
        );

        return new Response(
          JSON.stringify({ id: { id: 'TEXT-WAHA-001' } }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const res = createResponse();
    await handler(
      {
        method: 'POST',
        body: requestBody(),
        query: {}
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.replySent, true);
    assert.equal(res.payload.design.sent, false);
    assert.equal(
      res.payload.design.status,
      'DESIGN_DELIVERY_NOT_APPROVED'
    );
    assert.deepEqual(calls, [
      'https://orchestrator.test/api/messages',
      'https://waha.test/api/sendText'
    ]);
  });
});
