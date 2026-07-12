import test from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeWithOpenAI
} from '../adapters/openaiTtsAdapter.js';

test('OpenAI TTS exige texto', async () => {
  const result =
    await synthesizeWithOpenAI(
      {},
      {
        apiKey: 'test-key'
      }
    );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'OPENAI_TTS_TEXT_MISSING'
  );
});

test('OpenAI TTS exige API key', async () => {
  const previous =
    process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;

  try {
    const result =
      await synthesizeWithOpenAI({
        text: 'Hola'
      });

    assert.equal(
      result.status,
      'OPENAI_TTS_API_KEY_MISSING'
    );
  } finally {
    if (previous !== undefined) {
      process.env.OPENAI_API_KEY =
        previous;
    }
  }
});

test('OpenAI TTS rechaza formato no permitido', async () => {
  const result =
    await synthesizeWithOpenAI(
      {
        text: 'Hola',
        format: 'exe'
      },
      {
        apiKey: 'test-key'
      }
    );

  assert.equal(
    result.status,
    'OPENAI_TTS_FORMAT_NOT_ALLOWED'
  );
});

test('OpenAI TTS rechaza velocidad inválida', async () => {
  const result =
    await synthesizeWithOpenAI(
      {
        text: 'Hola',
        speed: 10
      },
      {
        apiKey: 'test-key'
      }
    );

  assert.equal(
    result.status,
    'OPENAI_TTS_SPEED_INVALID'
  );
});

test('OpenAI TTS usa Cedar y normaliza audio', async () => {
  let captured = null;

  const result =
    await synthesizeWithOpenAI(
      {
        text:
          '  Hola   desde ELAN IA  ',
        instructions:
          ' Voz natural y cercana. '
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
              Buffer.from(
                'AUDIO-TEST'
              ),
              {
                status: 200,
                headers: {
                  'content-type':
                    'audio/mpeg'
                }
              }
            );
          }
      }
    );

  assert.equal(result.ok, true);

  assert.equal(
    result.status,
    'OPENAI_TTS_GENERATED'
  );

  assert.equal(
    result.voice,
    'cedar'
  );

  assert.equal(
    result.model,
    'gpt-4o-mini-tts'
  );

  assert.equal(
    result.mimeType,
    'audio/mpeg'
  );

  assert.equal(
    result.audioBuffer.toString(),
    'AUDIO-TEST'
  );

  assert.equal(
    captured.body.input,
    'Hola desde ELAN IA'
  );

  assert.equal(
    captured.body.voice,
    'cedar'
  );

  assert.equal(
    captured.body.response_format,
    'mp3'
  );

  assert.equal(
    captured.body.speed,
    0.96
  );

  assert.equal(
    captured.body.instructions,
    'Voz natural y cercana.'
  );

  assert.match(
    captured.options.headers.Authorization,
    /^Bearer /
  );
});

test('OpenAI TTS controla autenticación inválida', async () => {
  const result =
    await synthesizeWithOpenAI(
      {
        text: 'Hola'
      },
      {
        apiKey: 'invalid-key',

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  type:
                    'invalid_request_error',
                  code:
                    'invalid_api_key'
                }
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
    'OPENAI_TTS_AUTH_FAILED'
  );

  assert.equal(
    result.httpStatus,
    401
  );
});

test('OpenAI TTS controla rate limit', async () => {
  const result =
    await synthesizeWithOpenAI(
      {
        text: 'Hola'
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  type:
                    'rate_limit_error'
                }
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
    'OPENAI_TTS_RATE_LIMITED'
  );
});

test('OpenAI TTS rechaza audio vacío', async () => {
  const result =
    await synthesizeWithOpenAI(
      {
        text: 'Hola'
      },
      {
        apiKey: 'test-key',

        fetchImpl:
          async () =>
            new Response(
              new Uint8Array(),
              {
                status: 200
              }
            )
      }
    );

  assert.equal(
    result.status,
    'OPENAI_TTS_EMPTY_AUDIO'
  );
});
