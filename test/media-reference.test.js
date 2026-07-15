import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSignedImageReference,
  verifyMediaSignature
} from '../services/mediaReferenceService.js';

const SECRET = 'media01-test-secret-with-at-least-32-characters';
const NOW = Date.UTC(2026, 6, 15, 0, 0, 0);

test('crea referencia firmada sin exponer la clave WAHA', () => {
  const result = createSignedImageReference(
    {
      isImage: true,
      messageId: 'IMG-001',
      mediaUrl: 'http://localhost:3000/api/files/IMG-001.jpg',
      mimeType: 'image/jpeg',
      fileName: 'IMG-001.jpg'
    },
    {
      secret: SECRET,
      publicBaseUrl: 'https://elankav-core.vercel.app',
      now: NOW
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.reference.kind, 'image');
  assert.equal(result.reference.url.includes(SECRET), false);

  const url = new URL(result.reference.url);
  assert.equal(
    verifyMediaSignature({
      path: url.searchParams.get('path'),
      expires: url.searchParams.get('expires'),
      signature: url.searchParams.get('signature'),
      secret: SECRET,
      now: NOW
    }),
    true
  );
});

test('rechaza ruta ajena y firma expirada', () => {
  const rejected = createSignedImageReference(
    {
      isImage: true,
      mediaUrl: 'https://attacker.example/image.jpg',
      mimeType: 'image/jpeg'
    },
    { secret: SECRET, now: NOW }
  );

  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 'IMAGE_MEDIA_PATH_NOT_ALLOWED');

  assert.equal(
    verifyMediaSignature({
      path: '/api/files/IMG-001.jpg',
      expires: Math.floor(NOW / 1000) - 1,
      signature: '00'.repeat(32),
      secret: SECRET,
      now: NOW
    }),
    false
  );
});
