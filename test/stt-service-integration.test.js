import test from 'node:test';
import assert from 'node:assert/strict';

import {
  transcribeAudio
} from '../services/sttService.js';

function audioInput(overrides = {}) {
  return {
    audio: {
      mediaUrl:
        '/api/files/ELANKAV/audio.oga',
      mimeType:
        'audio/ogg; codecs=opus',
      ...overrides
    },
    language: 'es'
  };
}

test('STT Service exige audio', async () => {
  const result = await transcribeAudio();

  assert.equal(result.ok, false);
  assert.equal(
    result.status,
    'STT_AUDIO_INPUT_MISSING'
  );
});

test('STT Service procesa descarga, proveedor y normalización', async () => {
  const calls = [];

  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async (audio) => {
        calls.push([
          'download',
          audio.mediaUrl
        ]);

        return {
          ok: true,
          status: 'AUDIO_DOWNLOADED',
          filePath: '/tmp/audio-test.oga',
          mimeType: 'audio/ogg',
          sizeBytes: 2048
        };
      },

      transcribe: async (input) => {
        calls.push([
          'transcribe',
          input.filePath,
          input.language
        ]);

        return {
          ok: true,
          status:
            'OPENAI_SPEECH_TRANSCRIBED',
          text:
            '  Hola   desde ELAN IA  ',
          language: 'es',
          provider: 'openai',
          model:
            'gpt-4o-mini-transcribe'
        };
      },

      removeTemporaryFile:
        async (filePath) => {
          calls.push([
            'cleanup',
            filePath
          ]);

          return {
            removed: true,
            reason: null
          };
        }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.status,
    'STT_TRANSCRIPTION_READY'
  );

  assert.equal(
    result.transcription.text,
    'Hola desde ELAN IA'
  );

  assert.equal(
    result.transcription.language,
    'es'
  );

  assert.equal(
    result.transcription.provider,
    'openai'
  );

  assert.equal(
    result.transcription.model,
    'gpt-4o-mini-transcribe'
  );

  assert.equal(
    result.download.mimeType,
    'audio/ogg'
  );

  assert.equal(
    result.download.sizeBytes,
    2048
  );

  assert.deepEqual(
    result.cleanup,
    {
      removed: true,
      reason: null
    }
  );

  assert.deepEqual(
    calls,
    [
      [
        'download',
        '/api/files/ELANKAV/audio.oga'
      ],
      [
        'transcribe',
        '/tmp/audio-test.oga',
        'es'
      ],
      [
        'cleanup',
        '/tmp/audio-test.oga'
      ]
    ]
  );
});

test('STT Service no llama proveedor si falla descarga', async () => {
  let providerCalled = false;
  let cleanupCalled = false;

  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async () => ({
        ok: false,
        status:
          'AUDIO_DOWNLOAD_HTTP_ERROR',
        filePath: null
      }),

      transcribe: async () => {
        providerCalled = true;
      },

      removeTemporaryFile:
        async () => {
          cleanupCalled = true;
        }
    }
  );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'AUDIO_DOWNLOAD_HTTP_ERROR'
  );

  assert.equal(providerCalled, false);
  assert.equal(cleanupCalled, false);
});

test('STT Service limpia archivo cuando falla proveedor', async () => {
  let cleanupPath = null;

  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async () => ({
        ok: true,
        filePath: '/tmp/provider-fail.oga',
        mimeType: 'audio/ogg',
        sizeBytes: 1024
      }),

      transcribe: async () => ({
        ok: false,
        status:
          'OPENAI_SPEECH_RATE_LIMITED',
        provider: 'openai'
      }),

      removeTemporaryFile:
        async (filePath) => {
          cleanupPath = filePath;

          return {
            removed: true,
            reason: null
          };
        }
    }
  );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'OPENAI_SPEECH_RATE_LIMITED'
  );

  assert.equal(
    cleanupPath,
    '/tmp/provider-fail.oga'
  );

  assert.equal(
    result.cleanup.removed,
    true
  );
});

test('STT Service limpia archivo cuando proveedor lanza excepción', async () => {
  let cleanupCalled = false;

  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async () => ({
        ok: true,
        filePath:
          '/tmp/provider-exception.oga',
        mimeType: 'audio/ogg',
        sizeBytes: 100
      }),

      transcribe: async () => {
        throw Object.assign(
          new Error('provider failure'),
          {
            code: 'PROVIDER_EXCEPTION'
          }
        );
      },

      removeTemporaryFile:
        async () => {
          cleanupCalled = true;

          return {
            removed: true,
            reason: null
          };
        }
    }
  );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'STT_UNEXPECTED_ERROR'
  );

  assert.equal(
    result.errorCode,
    'PROVIDER_EXCEPTION'
  );

  assert.equal(cleanupCalled, true);
  assert.equal(
    result.cleanup.removed,
    true
  );
});

test('STT Service reporta limpieza fallida sin ocultar transcripción', async () => {
  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async () => ({
        ok: true,
        filePath:
          '/tmp/cleanup-fail.oga',
        mimeType: 'audio/ogg',
        sizeBytes: 512
      }),

      transcribe: async () => ({
        ok: true,
        text: 'Transcripción válida',
        language: 'es',
        provider: 'test',
        model: 'test-model'
      }),

      removeTemporaryFile:
        async () => {
          throw new Error(
            'cleanup failure'
          );
        }
    }
  );

  assert.equal(result.ok, true);

  assert.equal(
    result.transcription.text,
    'Transcripción válida'
  );

  assert.deepEqual(
    result.cleanup,
    {
      removed: false,
      reason:
        'TEMP_FILE_CLEANUP_FAILED'
    }
  );
});

test('STT Service rechaza transcripción vacía y limpia temporal', async () => {
  let cleanupCalled = false;

  const result = await transcribeAudio(
    audioInput(),
    {
      downloadAudio: async () => ({
        ok: true,
        filePath:
          '/tmp/empty-transcription.oga',
        mimeType: 'audio/ogg',
        sizeBytes: 256
      }),

      transcribe: async () => ({
        ok: true,
        text: '   ',
        language: 'es',
        provider: 'test',
        model: 'test-model'
      }),

      removeTemporaryFile:
        async () => {
          cleanupCalled = true;

          return {
            removed: true,
            reason: null
          };
        }
    }
  );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'STT_EMPTY_TRANSCRIPTION'
  );

  assert.equal(cleanupCalled, true);
  assert.equal(
    result.cleanup.removed,
    true
  );
});
