import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

import {
  downloadAudioToTemporaryFile
} from '../services/audioDownloadService.js';

import {
  createTemporaryAudioFile,
  removeTemporaryFile
} from '../services/tempFileService.js';

test('Temp File crea archivo privado y lo elimina', async () => {
  const created = await createTemporaryAudioFile({
    buffer: Buffer.from('audio-test'),
    extension: 'oga'
  });

  assert.equal(created.ok, true);
  assert.equal(created.status, 'TEMP_FILE_CREATED');

  const content = await fs.readFile(created.filePath, 'utf8');
  assert.equal(content, 'audio-test');

  const removed = await removeTemporaryFile(created.filePath);

  assert.equal(removed.removed, true);

  await assert.rejects(
    fs.access(created.filePath)
  );
});

test('Temp File rechaza contenido vacío', async () => {
  const result = await createTemporaryAudioFile({
    buffer: Buffer.alloc(0),
    extension: 'oga'
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'TEMP_FILE_CONTENT_MISSING');
});

test('Download exige URL de media', async () => {
  const result = await downloadAudioToTemporaryFile(
    {},
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'AUDIO_MEDIA_URL_MISSING');
});

test('Download exige autenticación WAHA', async () => {
  const previousKey = process.env.WAHA_API_KEY;
  const previousToken = process.env.WAHA_API_TOKEN;

  delete process.env.WAHA_API_KEY;
  delete process.env.WAHA_API_TOKEN;

  try {
    const result = await downloadAudioToTemporaryFile({
      mediaUrl:
        'https://waha.elankav.com/api/files/ELANKAV/audio.oga',
      mimeType: 'audio/ogg; codecs=opus'
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 'WAHA_AUTH_MISSING');
  } finally {
    if (previousKey !== undefined) {
      process.env.WAHA_API_KEY = previousKey;
    }

    if (previousToken !== undefined) {
      process.env.WAHA_API_TOKEN = previousToken;
    }
  }
});

test('Download bloquea hosts externos', async () => {
  const result = await downloadAudioToTemporaryFile(
    {
      mediaUrl: 'https://example.com/audio.oga',
      mimeType: 'audio/ogg'
    },
    {
      apiKey: 'test-key',
      baseUrl: 'https://waha.elankav.com'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'AUDIO_MEDIA_URL_NOT_ALLOWED');
});

test('Download bloquea rutas ajenas a archivos WAHA', async () => {
  const result = await downloadAudioToTemporaryFile(
    {
      mediaUrl: 'https://waha.elankav.com/api/version',
      mimeType: 'audio/ogg'
    },
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'AUDIO_MEDIA_PATH_NOT_ALLOWED');
});

test('Download guarda audio y normaliza MIME con codecs', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    assert.equal(
      url.toString(),
      'https://waha.elankav.com/api/files/ELANKAV/audio.oga'
    );

    assert.equal(options.headers['X-Api-Key'], 'test-key');

    return new Response(
      Buffer.from('contenido-audio'),
      {
        status: 200,
        headers: {
          'content-type': 'audio/ogg; codecs=opus',
          'content-length': '15'
        }
      }
    );
  };

  let result;

  try {
    result = await downloadAudioToTemporaryFile(
      {
        mediaUrl: '/api/files/ELANKAV/audio.oga',
        mimeType: 'audio/ogg; codecs=opus'
      },
      {
        apiKey: 'test-key',
        baseUrl: 'https://waha.elankav.com'
      }
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, 'AUDIO_DOWNLOADED');
    assert.equal(result.mimeType, 'audio/ogg');
    assert.equal(result.sizeBytes, 15);
    assert.match(result.filePath, /\.oga$/);

    const content = await fs.readFile(result.filePath, 'utf8');
    assert.equal(content, 'contenido-audio');
  } finally {
    globalThis.fetch = originalFetch;

    if (result?.filePath) {
      await removeTemporaryFile(result.filePath);
    }
  }
});

test('Download rechaza tamaño informado superior al límite', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      Buffer.from('audio'),
      {
        status: 200,
        headers: {
          'content-type': 'audio/ogg',
          'content-length': '5000'
        }
      }
    );

  try {
    const result = await downloadAudioToTemporaryFile(
      {
        mediaUrl: '/api/files/ELANKAV/audio.oga',
        mimeType: 'audio/ogg'
      },
      {
        apiKey: 'test-key',
        maxBytes: 100
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'AUDIO_DOWNLOAD_SIZE_EXCEEDED'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
