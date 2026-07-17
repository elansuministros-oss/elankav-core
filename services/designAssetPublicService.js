import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_PUBLIC_BASE_URL = 'https://elankav-core.vercel.app';
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function resolvePublicAssetSecret(env = process.env) {
  const secret = String(
    env.DESIGN_ASSET_PUBLIC_SECRET ||
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  if (!secret) {
    const error = new Error('Design asset public secret no configurado');
    error.code = 'DESIGN_ASSET_SECRET_NOT_CONFIGURED';
    throw error;
  }

  return secret;
}

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function normalizeAssetDescriptor(asset = {}) {
  const bucket = String(asset.bucket || '').trim();
  const path = String(asset.path || '').trim();
  const mimeType = String(asset.mimeType || asset.mime_type || 'image/png')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const name = String(asset.name || path.split('/').pop() || 'design-asset').trim().slice(0, 160);

  if (!bucket || !path) {
    const error = new Error('Referencia de asset incompleta');
    error.code = 'DESIGN_ASSET_REFERENCE_INVALID';
    throw error;
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const error = new Error('Tipo de imagen no publicable');
    error.code = 'DESIGN_ASSET_MIME_UNSUPPORTED';
    throw error;
  }

  if (bucket.includes('..') || path.includes('..') || bucket.includes('\\') || path.includes('\\')) {
    const error = new Error('Ruta de asset invalida');
    error.code = 'DESIGN_ASSET_PATH_INVALID';
    throw error;
  }

  return Object.freeze({ bucket, path, mimeType, name });
}

function createPublicAssetId(asset, { env = process.env } = {}) {
  const normalized = normalizeAssetDescriptor(asset);
  const payload = encode(JSON.stringify({
    v: 1,
    b: normalized.bucket,
    p: normalized.path,
    m: normalized.mimeType,
    n: normalized.name
  }));
  const signature = signPayload(payload, resolvePublicAssetSecret(env));
  return `${payload}.${signature}`;
}

function resolvePublicAssetId(assetId, { env = process.env } = {}) {
  const [payload, signature, ...rest] = String(assetId || '').split('.');
  if (!payload || !signature || rest.length) {
    const error = new Error('Identificador de asset invalido');
    error.code = 'DESIGN_ASSET_ID_INVALID';
    throw error;
  }

  const expected = signPayload(payload, resolvePublicAssetSecret(env));
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    const error = new Error('Firma de asset invalida');
    error.code = 'DESIGN_ASSET_SIGNATURE_INVALID';
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(decode(payload));
  } catch {
    const error = new Error('Contenido de asset invalido');
    error.code = 'DESIGN_ASSET_PAYLOAD_INVALID';
    throw error;
  }

  if (parsed?.v !== 1) {
    const error = new Error('Version de asset no soportada');
    error.code = 'DESIGN_ASSET_VERSION_UNSUPPORTED';
    throw error;
  }

  return normalizeAssetDescriptor({
    bucket: parsed.b,
    path: parsed.p,
    mimeType: parsed.m,
    name: parsed.n
  });
}

function createPublicAssetUrl(asset, { env = process.env } = {}) {
  const baseUrl = String(env.ELANKAV_CORE_PUBLIC_URL || DEFAULT_PUBLIC_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
  return `${baseUrl}/api/design-assets/${encodeURIComponent(createPublicAssetId(asset, { env }))}`;
}

export {
  ALLOWED_MIME_TYPES,
  DEFAULT_PUBLIC_BASE_URL,
  createPublicAssetId,
  createPublicAssetUrl,
  normalizeAssetDescriptor,
  resolvePublicAssetId,
  resolvePublicAssetSecret
};
