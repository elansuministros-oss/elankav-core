import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendVoiceWithWaha
} from '../adapters/wahaVoiceAdapter.js';

test('WAHA Voice exige chatId', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        audioBuffer:
          Buffer.from('AUDIO')
      },
      {
        apiKey: 'test-key'
      }
    );

  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.status,
    'WAHA_VOICE_CHAT_ID_MISSING'
  );
});

test('WAHA Voice exige audio', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '50588388940@c.us'
      },
      {
        apiKey: 'test-key'
      }
    );

  assert.equal(
    result.status,
    'WAHA_VOICE_AUDIO_MISSING'
  );
});

test('WAHA Voice exige API key', async () => {
  const previous =
    process.env.WAHA_API_KEY;

  delete process.env.WAHA_API_KEY;

  try {
    const result =
      await sendVoiceWithWaha({
        chatId:
          '50588388940@c.us',
        audioBuffer:
          Buffer.from('AUDIO')
      });

    assert.equal(
      result.status,
      'WAHA_VOICE_API_KEY_MISSING'
    );
  } finally {
    if (previous !== undefined) {
      process.env.WAHA_API_KEY =
        previous;
    }
  }
});

test('WAHA Voice normaliza teléfono y envía Base64', async () => {
  let captured = null;

  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '+505 8838 8940',
        session:
          'ELANKAV',
        audioBuffer:
          Buffer.from(
            'AUDIO-TEST'
          ),
        mimeType:
          'audio/mpeg',
        fileName:
          'cedar.mp3'
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async (
            url,
            options
          ) => {
            captured = {
              url,
              options,
              body:
                JSON.parse(
                  options.body
                )
            };

            return new Response(
              JSON.stringify({
                id: {
                  id:
                    'VOICE-001'
                }
              }),
              {
                status: 200,
                headers: {
                  'content-type':
                    'application/json'
                }
              }
            );
          }
      }
    );

  assert.equal(
    result.ok,
    true
  );

  assert.equal(
    result.status,
    'WAHA_VOICE_SENT'
  );

  assert.equal(
    result.chatId,
    '50588388940@c.us'
  );

  assert.equal(
    result.messageId,
    'VOICE-001'
  );

  assert.equal(
    captured.url,
    'http://127.0.0.1:3000/api/sendVoice'
  );

  assert.equal(
    captured.body.session,
    'ELANKAV'
  );

  assert.equal(
    captured.body.chatId,
    '50588388940@c.us'
  );

  assert.equal(
    captured.body.file.mimetype,
    'audio/mpeg'
  );

  assert.equal(
    captured.body.file.filename,
    'cedar.mp3'
  );

  assert.equal(
    Buffer.from(
      captured.body.file.data,
      'base64'
    ).toString(),
    'AUDIO-TEST'
  );

  assert.equal(
    captured.body.convert,
    true
  );

  assert.equal(
    captured.options.headers[
      'X-Api-Key'
    ],
    'test-key'
  );
});

test('WAHA Voice controla autenticación inválida', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '50588388940@c.us',
        audioBuffer:
          Buffer.from('AUDIO')
      },
      {
        apiKey: 'invalid-key',

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                error:
                  'Unauthorized'
              }),
              {
                status: 401,
                headers: {
                  'content-type':
                    'application/json'
                }
              }
            )
      }
    );

  assert.equal(
    result.status,
    'WAHA_VOICE_AUTH_FAILED'
  );

  assert.equal(
    result.httpStatus,
    401
  );
});

test('WAHA Voice controla endpoint inexistente', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '50588388940@c.us',
        audioBuffer:
          Buffer.from('AUDIO')
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                error:
                  'Not Found'
              }),
              {
                status: 404,
                headers: {
                  'content-type':
                    'application/json'
                }
              }
            )
      }
    );

  assert.equal(
    result.status,
    'WAHA_VOICE_ENDPOINT_NOT_FOUND'
  );
});

test('WAHA Voice controla rate limit', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '50588388940@c.us',
        audioBuffer:
          Buffer.from('AUDIO')
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                error:
                  'Too Many Requests'
              }),
              {
                status: 429,
                headers: {
                  'content-type':
                    'application/json'
                }
              }
            )
      }
    );

  assert.equal(
    result.status,
    'WAHA_VOICE_RATE_LIMITED'
  );
});

test('WAHA Voice controla excepción de red', async () => {
  const result =
    await sendVoiceWithWaha(
      {
        chatId:
          '50588388940@c.us',
        audioBuffer:
          Buffer.from('AUDIO')
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async () => {
            const error =
              new Error(
                'Network unavailable'
              );

            error.code =
              'ECONNREFUSED';

            throw error;
          }
      }
    );

  assert.equal(
    result.status,
    'WAHA_VOICE_UNEXPECTED_ERROR'
  );

  assert.equal(
    result.errorCode,
    'ECONNREFUSED'
  );
});
