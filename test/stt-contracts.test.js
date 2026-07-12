import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTranscription } from '../services/transcriptionNormalizer.js';
import { transcribeAudio } from '../services/sttService.js';
import { downloadAudioToTemporaryFile } from '../services/audioDownloadService.js';
import { transcribeWithOpenAI } from '../adapters/openaiSpeechAdapter.js';

test('Normalizer limpia espacios y conserva metadatos', () => {
  const result = normalizeTranscription({
    text: '  Hola   desde   ELAN IA  ',
    language: 'es',
    provider: 'openai'
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'STT_TRANSCRIPTION_READY');
  assert.equal(result.text, 'Hola desde ELAN IA');
  assert.equal(result.language, 'es');
  assert.equal(result.provider, 'openai');
});

test('Normalizer rechaza transcripción vacía', () => {
  const result = normalizeTranscription({
    text: '   '
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'STT_EMPTY_TRANSCRIPTION');
});

test('STT Service exige audio', async () => {
  const result = await transcribeAudio();

  assert.equal(result.ok, false);
  assert.equal(result.status, 'STT_AUDIO_INPUT_MISSING');
});

test('STT Service usa descarga predeterminada y exige URL de media', async () => {
  const result = await transcribeAudio({
    audio: {
      mediaReference: 'MEDIA-001'
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'AUDIO_MEDIA_URL_MISSING');
});

test('STT Service usa proveedor predeterminado y exige API key', async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;

  try {
    const result = await transcribeAudio(
      {
        audio: {
          mediaReference: 'MEDIA-001'
        }
      },
      {
        downloadAudio: async () => ({
          ok: true,
          filePath: '/tmp/audio-stt-contract.ogg',
          mimeType: 'audio/ogg',
          sizeBytes: 100
        }),
        removeTemporaryFile: async () => ({
          removed: true,
          reason: null
        })
      }
    );

    assert.equal(result.ok, false);
    assert.equal(
      result.status,
      'OPENAI_SPEECH_API_KEY_MISSING'
    );

    assert.deepEqual(
      result.cleanup,
      {
        removed: true,
        reason: null
      }
    );
  } finally {
    if (previousApiKey !== undefined) {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  }
});

test('STT Service devuelve transcripción normalizada', async () => {
  const result = await transcribeAudio(
    {
      audio: {
        mediaReference: 'MEDIA-001'
      },
      language: 'es'
    },
    {
      downloadAudio: async () => ({
        ok: true,
        filePath: '/tmp/audio.ogg',
        mimeType: 'audio/ogg'
      }),
      transcribe: async () => ({
        ok: true,
        text: '  Prueba   correcta  ',
        language: 'es',
        provider: 'test'
      })
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'STT_TRANSCRIPTION_READY');
  assert.equal(result.transcription.text, 'Prueba correcta');
});

test('Audio Download Service exige URL de media', async () => {
  const result = await downloadAudioToTemporaryFile(
    {},
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'AUDIO_MEDIA_URL_MISSING');
});

test('OpenAI Speech Adapter exige archivo', async () => {
  const result = await transcribeWithOpenAI(
    {},
    {
      apiKey: 'test-key'
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'OPENAI_SPEECH_FILE_MISSING');
  assert.equal(result.provider, 'openai');
});
