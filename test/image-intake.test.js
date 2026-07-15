import test from 'node:test';
import assert from 'node:assert/strict';

import { extractImageCandidate } from '../adapters/imageIntakeAdapter.js';

test('extrae imagen WAHA desde payload.media', () => {
  const result = extractImageCandidate({
    event: 'message',
    payload: {
      id: 'IMG-001',
      type: 'image',
      mimetype: 'image/jpeg',
      media: {
        url: 'http://localhost:3000/api/files/IMG-001.jpg',
        filename: 'referencia.jpg'
      }
    }
  });

  assert.equal(result.isImage, true);
  assert.equal(result.messageId, 'IMG-001');
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.fileName, 'referencia.jpg');
  assert.equal(result.mediaUrl, 'http://localhost:3000/api/files/IMG-001.jpg');
});

test('no confunde audio con imagen', () => {
  const result = extractImageCandidate({
    payload: {
      type: 'ptt',
      mimetype: 'audio/ogg',
      media: { url: '/api/files/audio.oga' }
    }
  });

  assert.equal(result.isImage, false);
});
