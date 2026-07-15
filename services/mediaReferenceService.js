import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 5 * 60;
const DEFAULT_PUBLIC_BASE_URL = 'https://elankav-core.vercel.app';
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function normalizeMimeType(value) {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function resolveMediaPath(mediaUrl) {
  if (!mediaUrl) {
    throw new Error('IMAGE_MEDIA_URL_MISSING');
  }

  const parsed = new URL(mediaUrl, 'https://waha.invalid');
  const pathname = parsed.pathname;

  if (
    !pathname.startsWith('/api/files/') ||
    pathname.includes('..') ||
    pathname.includes('\\') ||
    pathname.length > 2048
  ) {
    throw new Error('IMAGE_MEDIA_PATH_NOT_ALLOWED');
  }

  return pathname;
}

function signatureFor({ path, expires, secret }) {
  return createHmac('sha256', secret)
    .update(`${path}\n${expires}`)
    .digest('hex');
}

export function verifyMediaSignature({
  path,
  expires,
  signature,
  secret = process.env.MEDIA_REFERENCE_SIGNING_SECRET,
  now = Date.now()
} = {}) {
  if (!secret || !path || !expires || !signature) {
    return false;
  }

  const expiration = Number(expires);
  if (!Number.isInteger(expiration) || expiration * 1000 < now) {
    return false;
  }

  let normalizedPath;
  try {
    normalizedPath = resolveMediaPath(path);
  } catch {
    return false;
  }

  const expected = signatureFor({
    path: normalizedPath,
    expires: expiration,
    secret
  });
  const receivedBuffer = Buffer.from(String(signature), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function createSignedImageReference(
  candidate = {},
  {
    secret = process.env.MEDIA_REFERENCE_SIGNING_SECRET,
    publicBaseUrl = process.env.CORE_PUBLIC_BASE_URL ||
      DEFAULT_PUBLIC_BASE_URL,
    now = Date.now(),
    ttlSeconds = DEFAULT_TTL_SECONDS
  } = {}
) {
  if (!candidate.isImage) {
    return { ok: false, status: 'IMAGE_NOT_DETECTED', reference: null };
  }

  const mimeType = normalizeMimeType(candidate.mimeType);
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { ok: false, status: 'IMAGE_MIME_NOT_ALLOWED', reference: null };
  }

  if (!secret || secret.length < 32) {
    return { ok: false, status: 'MEDIA_SIGNING_NOT_CONFIGURED', reference: null };
  }

  let path;
  try {
    path = resolveMediaPath(candidate.mediaUrl);
  } catch (error) {
    return { ok: false, status: error.message, reference: null };
  }

  const expires = Math.floor(now / 1000) + Number(ttlSeconds);
  const signature = signatureFor({ path, expires, secret });
  const url = new URL('/api/whatsapp-media', publicBaseUrl);
  url.searchParams.set('path', path);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);

  return {
    ok: true,
    status: 'IMAGE_REFERENCE_READY',
    reference: Object.freeze({
      kind: 'image',
      source: 'waha',
      url: url.toString(),
      mimeType,
      fileName: candidate.fileName || null,
      messageId: candidate.messageId || null,
      expiresAt: new Date(expires * 1000).toISOString()
    })
  };
}

export {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_TTL_SECONDS,
  resolveMediaPath
};
