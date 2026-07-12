import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAudioCandidate
} from '../adapters/audioIntakeAdapter.js';

import {
  validateAudioIntake
} from '../services/audioIntakeService.js';

function audioPayload(overrides = {}) {
  return {
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: { id: 'MSG-001' },
      from: '50500000000@c.us',
      type: 'ptt',
      mimetype: 'audio/ogg',
      duration: 18,
      size: 2048,
      media: {
        id: 'MEDIA-001'
      },
      ...overrides
    }
  };
}

test('Adapter detecta nota de voz WAHA', () => {
  const result = extractAudioCandidate(audioPayload());

  assert.equal(result.isAudio, true);
  assert.equal(result.messageId, 'MSG-001');
  assert.equal(result.chatId, '50500000000@c.us');
  assert.equal(result.mimeType, 'audio/ogg');
  assert.equal(result.isVoiceNote, true);
});

test('Adapter no clasifica texto como audio', () => {
  const result = extractAudioCandidate({
    event: 'message',
    payload: {
      id: { id: 'TEXT-001' },
      from: '50500000000@c.us',
      type: 'chat',
      body: 'Hola'
    }
  });

  assert.equal(result.isAudio, false);
});

test('Service acepta audio válido', () => {
  const candidate = extractAudioCandidate(audioPayload());
  const result = validateAudioIntake(candidate);

  assert.equal(result.accepted, true);
  assert.equal(result.status, 'AUDIO_ACCEPTED');
  assert.equal(result.audio.hasMediaReference, true);
});

test('Service rechaza audio sin MIME', () => {
  const candidate = extractAudioCandidate(
    audioPayload({ mimetype: undefined })
  );

  const result = validateAudioIntake(candidate);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'AUDIO_METADATA_INCOMPLETE');
});

test('Service rechaza MIME no autorizado', () => {
  const candidate = extractAudioCandidate(
    audioPayload({ mimetype: 'application/pdf' })
  );

  const result = validateAudioIntake({
    ...candidate,
    isAudio: true
  });

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'AUDIO_TYPE_NOT_ALLOWED');
});

test('Service rechaza audio sin referencia', () => {
  const candidate = extractAudioCandidate(
    audioPayload({ media: undefined })
  );

  const result = validateAudioIntake(candidate);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'AUDIO_REFERENCE_MISSING');
});

test('Service rechaza tamaño excedido', () => {
  const candidate = extractAudioCandidate(
    audioPayload({ size: 30 * 1024 * 1024 })
  );

  const result = validateAudioIntake(candidate);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'AUDIO_SIZE_EXCEEDED');
});

test('Service rechaza duración excedida', () => {
  const candidate = extractAudioCandidate(
    audioPayload({ duration: 301 })
  );

  const result = validateAudioIntake(candidate);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'AUDIO_DURATION_EXCEEDED');
});
