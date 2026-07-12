import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateVoiceResponse,
  resolveVoiceProfile
} from '../services/ttsService.js';

test('TTS Service exige texto', async () => {
  const result =
    await generateVoiceResponse();

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'TTS_TEXT_MISSING'
  );
});

test('TTS Service usa perfil oficial Cedar', () => {
  const profile =
    resolveVoiceProfile({});

  assert.equal(
    profile.profile,
    'elan-ia-official-v1'
  );

  assert.equal(
    profile.language,
    'es-419'
  );

  assert.equal(
    profile.voice,
    'cedar'
  );

  assert.equal(
    profile.model,
    'gpt-4o-mini-tts'
  );

  assert.equal(
    profile.format,
    'mp3'
  );

  assert.equal(
    Number(profile.speed),
    0.96
  );
});

test('TTS Service genera contrato de audio', async () => {
  let captured = null;

  const result =
    await generateVoiceResponse(
      {
        text:
          '  Hola   desde ELAN IA  '
      },
      {
        synthesize:
          async (input) => {
            captured = input;

            return {
              ok: true,
              status:
                'OPENAI_TTS_GENERATED',
              provider: 'openai',
              model:
                'gpt-4o-mini-tts',
              voice: 'cedar',
              format: 'mp3',
              mimeType:
                'audio/mpeg',
              sizeBytes: 10,
              audioBuffer:
                Buffer.from(
                  'AUDIO-TEST'
                )
            };
          }
      }
    );

  assert.equal(result.ok, true);

  assert.equal(
    result.status,
    'TTS_AUDIO_READY'
  );

  assert.equal(
    result.profile,
    'elan-ia-official-v1'
  );

  assert.equal(
    result.voice,
    'cedar'
  );

  assert.equal(
    result.audio.mimeType,
    'audio/mpeg'
  );

  assert.equal(
    result.audio.buffer.toString(),
    'AUDIO-TEST'
  );

  assert.match(
    result.audio.fileName,
    /^elan-ia-\d+\.mp3$/
  );

  assert.equal(
    captured.text,
    'Hola desde ELAN IA'
  );

  assert.equal(
    captured.voice,
    'cedar'
  );
});

test('TTS Service propaga fallo controlado del proveedor', async () => {
  const result =
    await generateVoiceResponse(
      {
        text: 'Hola'
      },
      {
        synthesize:
          async () => ({
            ok: false,
            status:
              'OPENAI_TTS_RATE_LIMITED',
            provider: 'openai'
          })
      }
    );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'OPENAI_TTS_RATE_LIMITED'
  );

  assert.equal(
    result.provider,
    'openai'
  );
});

test('TTS Service rechaza audio vacío', async () => {
  const result =
    await generateVoiceResponse(
      {
        text: 'Hola'
      },
      {
        synthesize:
          async () => ({
            ok: true,
            provider: 'openai',
            model:
              'gpt-4o-mini-tts',
            voice: 'cedar',
            format: 'mp3',
            mimeType:
              'audio/mpeg',
            sizeBytes: 0,
            audioBuffer:
              Buffer.alloc(0)
          })
      }
    );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'TTS_AUDIO_EMPTY'
  );
});

test('TTS Service controla excepción del proveedor', async () => {
  const result =
    await generateVoiceResponse(
      {
        text: 'Hola'
      },
      {
        synthesize:
          async () => {
            const error =
              new Error(
                'Provider unavailable'
              );

            error.code =
              'PROVIDER_DOWN';

            throw error;
          }
      }
    );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'TTS_UNEXPECTED_ERROR'
  );

  assert.equal(
    result.errorCode,
    'PROVIDER_DOWN'
  );
});
