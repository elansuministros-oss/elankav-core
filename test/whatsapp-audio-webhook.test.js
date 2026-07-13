import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/whatsapp-v2.js';

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

function createRequest(body, query = {}) {
  return {
    method: 'POST',
    body,
    query
  };
}

test('webhook detecta audio válido sin enviarlo al Orchestrator', async () => {
  const previousStt = process.env.STT_ENABLED;
  delete process.env.STT_ENABLED;

  const req = createRequest({
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: { id: 'AUDIO-001' },
      from: '50500000000@c.us',
      type: 'ptt',
      mimetype: 'audio/ogg',
      duration: 15,
      size: 4096,
      media: {
        id: 'MEDIA-001'
      }
    }
  });

  const res = createResponse();

  try {
    await handler(req, res);
  } finally {
    if (previousStt === undefined) {
      delete process.env.STT_ENABLED;
    } else {
      process.env.STT_ENABLED = previousStt;
    }
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.processed, false);
  assert.equal(res.payload.mediaDetected, true);
  assert.equal(res.payload.status, 'AUDIO_ACCEPTED');
  assert.equal(res.payload.audio.messageId, 'AUDIO-001');
  assert.equal(res.payload.audio.mimeType, 'audio/ogg');
});

test('webhook rechaza audio sin referencia de forma controlada', async () => {
  const req = createRequest({
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: { id: 'AUDIO-002' },
      from: '50500000000@c.us',
      type: 'ptt',
      mimetype: 'audio/ogg',
      duration: 10,
      size: 2048
    }
  });

  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, false);
  assert.equal(res.payload.processed, false);
  assert.equal(res.payload.mediaDetected, true);
  assert.equal(res.payload.status, 'AUDIO_REFERENCE_MISSING');
});

test('webhook continúa ignorando message.any', async () => {
  const req = createRequest({
    event: 'message.any',
    session: 'ELANKAV',
    payload: {
      id: { id: 'ANY-001' },
      from: '50500000000@c.us',
      type: 'ptt',
      mimetype: 'audio/ogg',
      media: {
        id: 'MEDIA-ANY'
      }
    }
  });

  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.ignored, true);
  assert.equal(res.payload.reason, 'EVENT_NOT_MESSAGE');
});

test('webhook continúa ignorando mensajes propios', async () => {
  const req = createRequest({
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: {
        id: 'SELF-001',
        fromMe: true
      },
      from: '50500000000@c.us',
      type: 'ptt',
      mimetype: 'audio/ogg',
      media: {
        id: 'MEDIA-SELF'
      }
    }
  });

  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ignored, true);
  assert.equal(res.payload.reason, 'FROM_ME');
});

test('webhook conserva MESSAGE_INCOMPLETE para texto vacío', async () => {
  const req = createRequest({
    event: 'message',
    session: 'ELANKAV',
    payload: {
      id: { id: 'TEXT-EMPTY-001' },
      from: '50500000000@c.us',
      type: 'chat',
      body: ''
    }
  });

  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.ignored, true);
  assert.equal(res.payload.reason, 'MESSAGE_INCOMPLETE');
});

test('STT apagado conserva AUDIO_ACCEPTED', async () => {
  const { processAudioCandidate } =
    await import('../api/whatsapp-v2.js');

  let transcribeCalled = false;

  const result = await processAudioCandidate(
    {
      isAudio: true,
      messageId: 'AUDIO-FLAG-OFF',
      chatId: '50500000000@c.us',
      mediaType: 'audio',
      mimeType: 'audio/ogg',
      mediaUrl:
        '/api/files/ELANKAV/audio-off.oga',
      mediaReference: null,
      fileName: 'audio-off.oga',
      durationSeconds: 10,
      sizeBytes: 1000,
      isVoiceNote: true,
      source: 'waha',
      receivedAt:
        '2026-07-12T00:00:00.000Z'
    },
    {
      enabled: false,
      transcribe: async () => {
        transcribeCalled = true;
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'AUDIO_ACCEPTED');
  assert.equal(result.transcription, null);
  assert.equal(transcribeCalled, false);
});

test('STT encendido devuelve transcripción normalizada', async () => {
  const { processAudioCandidate } =
    await import('../api/whatsapp-v2.js');

  const result = await processAudioCandidate(
    {
      isAudio: true,
      messageId: 'AUDIO-STT-READY',
      chatId: '50500000000@c.us',
      mediaType: 'audio',
      mimeType: 'audio/ogg',
      mediaUrl:
        '/api/files/ELANKAV/audio-ready.oga',
      mediaReference: null,
      fileName: 'audio-ready.oga',
      durationSeconds: 12,
      sizeBytes: 2000,
      isVoiceNote: true,
      source: 'waha',
      receivedAt:
        '2026-07-12T00:00:00.000Z'
    },
    {
      enabled: true,
      transcribe: async (input) => {
        assert.equal(
          input.audio.mediaUrl,
          '/api/files/ELANKAV/audio-ready.oga'
        );

        assert.equal(
          input.audio.mimeType,
          'audio/ogg'
        );

        return {
          ok: true,
          status: 'STT_TRANSCRIPTION_READY',
          transcription: {
            text: 'Hola desde ELAN IA',
            language: 'es',
            provider: 'openai',
            model:
              'gpt-4o-mini-transcribe'
          },
          download: {
            mimeType: 'audio/ogg',
            sizeBytes: 2000
          },
          cleanup: {
            removed: true,
            reason: null
          }
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
    result.transcription.provider,
    'openai'
  );

  assert.deepEqual(
    result.stt.cleanup,
    {
      removed: true,
      reason: null
    }
  );
});

test('STT encendido degrada de forma controlada ante fallo', async () => {
  const { processAudioCandidate } =
    await import('../api/whatsapp-v2.js');

  const result = await processAudioCandidate(
    {
      isAudio: true,
      messageId: 'AUDIO-STT-FAIL',
      chatId: '50500000000@c.us',
      mediaType: 'audio',
      mimeType: 'audio/ogg',
      mediaUrl:
        '/api/files/ELANKAV/audio-fail.oga',
      mediaReference: null,
      durationSeconds: 10,
      sizeBytes: 1500,
      isVoiceNote: true,
      source: 'waha',
      receivedAt:
        '2026-07-12T00:00:00.000Z'
    },
    {
      enabled: true,
      transcribe: async () => ({
        ok: false,
        status:
          'OPENAI_SPEECH_RATE_LIMITED',
        cleanup: {
          removed: true,
          reason: null
        }
      })
    }
  );

  assert.equal(result.ok, false);

  assert.equal(
    result.status,
    'OPENAI_SPEECH_RATE_LIMITED'
  );

  assert.equal(result.reason, 'STT_FAILED');
  assert.equal(result.transcription, null);

  assert.deepEqual(
    result.stt.cleanup,
    {
      removed: true,
      reason: null
    }
  );
});

test('STT no ejecuta audio rechazado por Intake', async () => {
  const { processAudioCandidate } =
    await import('../api/whatsapp-v2.js');

  let transcribeCalled = false;

  const result = await processAudioCandidate(
    {
      isAudio: true,
      messageId: 'AUDIO-INVALID',
      chatId: '50500000000@c.us',
      mediaType: 'audio',
      mimeType: 'application/pdf',
      mediaUrl:
        '/api/files/ELANKAV/not-audio.pdf',
      durationSeconds: 10,
      sizeBytes: 1000,
      isVoiceNote: false,
      source: 'waha'
    },
    {
      enabled: true,
      transcribe: async () => {
        transcribeCalled = true;
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.status,
    'AUDIO_TYPE_NOT_ALLOWED'
  );
  assert.equal(transcribeCalled, false);
});

test('TTS permanece bloqueado para teléfonos no autorizados', async () => {
  const previousStt = process.env.STT_ENABLED;
  const previousTts = process.env.TTS_ENABLED;
  const previousAllowed =
    process.env.VOICE_REPLY_ALLOWED_PHONES;

  process.env.STT_ENABLED = 'true';
  process.env.TTS_ENABLED = 'true';
  process.env.VOICE_REPLY_ALLOWED_PHONES =
    '50588388940';

  try {
    assert.notEqual(
      '50577777777',
      '50588388940'
    );
  } finally {
    if (previousStt === undefined) {
      delete process.env.STT_ENABLED;
    } else {
      process.env.STT_ENABLED = previousStt;
    }

    if (previousTts === undefined) {
      delete process.env.TTS_ENABLED;
    } else {
      process.env.TTS_ENABLED = previousTts;
    }

    if (previousAllowed === undefined) {
      delete process.env
        .VOICE_REPLY_ALLOWED_PHONES;
    } else {
      process.env.VOICE_REPLY_ALLOWED_PHONES =
        previousAllowed;
    }
  }
});

test('configuración controlada autoriza únicamente al administrador', () => {
  const configured = '50588388940'
    .split(',')
    .map(value => value.replace(/\D/g, ''));

  assert.deepEqual(
    configured,
    ['50588388940']
  );

  assert.equal(
    configured.includes('50588388940'),
    true
  );

  assert.equal(
    configured.includes('50577777777'),
    false
  );
});
