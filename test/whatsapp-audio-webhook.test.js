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

  await handler(req, res);

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
