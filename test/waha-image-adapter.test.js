import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import {
  sendImageWithWaha
} from '../adapters/wahaImageAdapter.js';

test('WAHA Image exige chatId, imagen y API key', async () => {
  const noChat = await sendImageWithWaha(
    { imageBuffer: Buffer.from('JPEG') },
    { apiKey: 'test-key' }
  );

  assert.equal(noChat.status, 'WAHA_IMAGE_CHAT_ID_MISSING');

  const noImage = await sendImageWithWaha(
    { chatId: '50588388940@c.us' },
    { apiKey: 'test-key' }
  );

  assert.equal(noImage.status, 'WAHA_IMAGE_DATA_MISSING');

  const previous = globalThis.process.env.WAHA_API_KEY;
  const previousToken = globalThis.process.env.WAHA_API_TOKEN;
  delete globalThis.process.env.WAHA_API_KEY;
  delete globalThis.process.env.WAHA_API_TOKEN;

  try {
    const noKey = await sendImageWithWaha({
      chatId: '50588388940@c.us',
      imageBuffer: Buffer.from('JPEG')
    });

    assert.equal(noKey.status, 'WAHA_IMAGE_API_KEY_MISSING');
  } finally {
    if (previous !== undefined) {
      globalThis.process.env.WAHA_API_KEY = previous;
    }

    if (previousToken !== undefined) {
      globalThis.process.env.WAHA_API_TOKEN = previousToken;
    }
  }
});

test('WAHA Image envía JPEG Base64 con caption', async () => {
  let captured = null;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  const result = await sendImageWithWaha(
    {
      chatId: '+505 8838 8940',
      session: 'ELANKAV',
      imageBuffer: jpeg,
      fileName: 'design.jpg',
      caption: 'Propuesta aprobada'
    },
    {
      apiKey: 'test-key',
      baseUrl: 'https://waha.test/',
      fetchImpl: async (url, options) => {
        captured = {
          url,
          options,
          body: JSON.parse(options.body)
        };

        return new Response(
          JSON.stringify({ id: { id: 'IMAGE-001' } }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'WAHA_IMAGE_SENT');
  assert.equal(result.messageId, 'IMAGE-001');
  assert.equal(captured.url, 'https://waha.test/api/sendImage');
  assert.equal(captured.body.session, 'ELANKAV');
  assert.equal(captured.body.chatId, '50588388940@c.us');
  assert.equal(captured.body.file.mimetype, 'image/jpeg');
  assert.equal(captured.body.file.filename, 'design.jpg');
  assert.equal(captured.body.caption, 'Propuesta aprobada');
  assert.deepEqual(
    Buffer.from(captured.body.file.data, 'base64'),
    jpeg
  );
  assert.equal(captured.options.headers['X-Api-Key'], 'test-key');
});

test('WAHA Image controla error de autenticación', async () => {
  const result = await sendImageWithWaha(
    {
      chatId: '50588388940@c.us',
      imageBuffer: Buffer.from('JPEG')
    },
    {
      apiKey: 'invalid-key',
      fetchImpl: async () => new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'WAHA_IMAGE_AUTH_FAILED');
  assert.equal(result.httpStatus, 401);
});
