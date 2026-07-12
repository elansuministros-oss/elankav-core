import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  transcribeWithOpenAI
} from '../adapters/openaiSpeechAdapter.js';

async function createAudioFile(
  content = 'audio-test'
) {
  const filePath = path.join(
    os.tmpdir(),
    `openai-stt-${crypto.randomUUID()}.oga`
  );

  await fs.writeFile(
    filePath,
    Buffer.from(content),
    {
      mode: 0o600
    }
  );

  return filePath;
}

test('OpenAI Speech exige archivo', async () => {
  const result = await transcribeWithOpenAI(
    {},
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.status,
    'OPENAI_SPEECH_FILE_MISSING'
  );
});

test('OpenAI Speech exige API key', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const filePath = await createAudioFile();

  try {
    const result = await transcribeWithOpenAI({
      filePath,
      mimeType: 'audio/ogg'
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_API_KEY_MISSING'
    );
  } finally {
    if (previous !== undefined) {
      process.env.OPENAI_API_KEY = previous;
    }

    await fs.unlink(filePath);
  }
});

test('OpenAI Speech rechaza modelo desconocido', async () => {
  const filePath = await createAudioFile();

  try {
    const result = await transcribeWithOpenAI(
      {
        filePath,
        mimeType: 'audio/ogg'
      },
      {
        apiKey: 'test-key',
        model: 'modelo-inventado'
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_MODEL_NOT_ALLOWED'
    );
  } finally {
    await fs.unlink(filePath);
  }
});

test('OpenAI Speech detecta archivo inexistente', async () => {
  const result = await transcribeWithOpenAI(
    {
      filePath: '/tmp/no-existe-audio.oga',
      mimeType: 'audio/ogg'
    },
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.status,
    'OPENAI_SPEECH_FILE_NOT_FOUND'
  );
});

test('OpenAI Speech envía multipart y normaliza respuesta', async () => {
  const originalFetch = globalThis.fetch;
  const filePath = await createAudioFile();

  globalThis.fetch = async (
    url,
    options
  ) => {
    assert.equal(
      url,
      'https://api.openai.com/v1/audio/transcriptions'
    );

    assert.equal(
      options.method,
      'POST'
    );

    assert.equal(
      options.headers.Authorization,
      'Bearer test-key'
    );

    assert.ok(
      options.body instanceof FormData
    );

    assert.equal(
      options.body.get('model'),
      'gpt-4o-mini-transcribe'
    );

    assert.equal(
      options.body.get('response_format'),
      'json'
    );

    assert.equal(
      options.body.get('language'),
      'es'
    );

    const file = options.body.get('file');

    assert.ok(file instanceof Blob);
    assert.equal(file.type, 'audio/ogg');

    return new Response(
      JSON.stringify({
        text: '  Hola desde ELAN IA  '
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    );
  };

  try {
    const result = await transcribeWithOpenAI(
      {
        filePath,
        mimeType: 'audio/ogg; codecs=opus',
        language: 'es'
      },
      {
        apiKey: 'test-key'
      }
    );

    assert.equal(result.ok, true);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_TRANSCRIBED'
    );
    assert.equal(
      result.text,
      'Hola desde ELAN IA'
    );
    assert.equal(result.language, 'es');
    assert.equal(result.provider, 'openai');
    assert.equal(
      result.model,
      'gpt-4o-mini-transcribe'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await fs.unlink(filePath);
  }
});

test('OpenAI Speech controla autenticación inválida', async () => {
  const originalFetch = globalThis.fetch;
  const filePath = await createAudioFile();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 'invalid_api_key'
        }
      }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json'
        }
      }
    );

  try {
    const result = await transcribeWithOpenAI(
      {
        filePath,
        mimeType: 'audio/ogg'
      },
      {
        apiKey: 'invalid-key'
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_AUTH_FAILED'
    );
    assert.equal(result.httpStatus, 401);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.unlink(filePath);
  }
});

test('OpenAI Speech controla rate limit', async () => {
  const originalFetch = globalThis.fetch;
  const filePath = await createAudioFile();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: 'Rate limited'
        }
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json'
        }
      }
    );

  try {
    const result = await transcribeWithOpenAI(
      {
        filePath,
        mimeType: 'audio/ogg'
      },
      {
        apiKey: 'test-key'
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_RATE_LIMITED'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await fs.unlink(filePath);
  }
});

test('OpenAI Speech controla respuesta vacía', async () => {
  const originalFetch = globalThis.fetch;
  const filePath = await createAudioFile();

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        text: ''
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    );

  try {
    const result = await transcribeWithOpenAI(
      {
        filePath,
        mimeType: 'audio/ogg'
      },
      {
        apiKey: 'test-key'
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_EMPTY_RESPONSE'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await fs.unlink(filePath);
  }
});
