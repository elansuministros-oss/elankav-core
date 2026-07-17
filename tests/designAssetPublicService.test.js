import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPublicAssetId,
  createPublicAssetUrl,
  normalizeAssetDescriptor,
  resolvePublicAssetId
} from '../services/designAssetPublicService.js';

const env = {
  DESIGN_ASSET_PUBLIC_SECRET: 'test-secret-that-is-long-enough',
  ELANKAV_CORE_PUBLIC_URL: 'https://core.example.com'
};

const asset = {
  bucket: 'design-request-assets',
  path: 'DESIGN-ABC-1234/result-final.png',
  mimeType: 'image/png',
  name: 'rotulo-final.png'
};

test('crea y resuelve un identificador estable sin fecha de expiracion', () => {
  const id = createPublicAssetId(asset, { env });
  assert.match(id, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(resolvePublicAssetId(id, { env }), asset);
});

test('construye URL publica estable del dominio Core', () => {
  const url = createPublicAssetUrl(asset, { env });
  assert.match(url, /^https:\/\/core\.example\.com\/api\/design-assets\//);
  assert.doesNotMatch(url, /token=|expires|signature=/i);
});

test('rechaza identificador manipulado', () => {
  const id = createPublicAssetId(asset, { env });
  const tampered = `${id.slice(0, -1)}${id.endsWith('a') ? 'b' : 'a'}`;
  assert.throws(
    () => resolvePublicAssetId(tampered, { env }),
    error => error?.code === 'DESIGN_ASSET_SIGNATURE_INVALID'
  );
});

test('rechaza MIME no publicable y rutas inseguras', () => {
  assert.throws(
    () => normalizeAssetDescriptor({ ...asset, mimeType: 'application/pdf' }),
    error => error?.code === 'DESIGN_ASSET_MIME_UNSUPPORTED'
  );
  assert.throws(
    () => normalizeAssetDescriptor({ ...asset, path: '../secreto.png' }),
    error => error?.code === 'DESIGN_ASSET_PATH_INVALID'
  );
});
