import { verifyMediaSignature } from '../services/mediaReferenceService.js';

const DEFAULT_WAHA_URL = 'https://waha.elankav.com';
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeMimeType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const path = String(req.query?.path || '');
  const expires = String(req.query?.expires || '');
  const signature = String(req.query?.signature || '');

  if (!verifyMediaSignature({ path, expires, signature })) {
    return sendJson(res, 403, { ok: false, error: 'MEDIA_REFERENCE_INVALID' });
  }

  const apiKey = process.env.WAHA_API_KEY;
  const apiToken = process.env.WAHA_API_TOKEN;
  if (!apiKey && !apiToken) {
    return sendJson(res, 503, { ok: false, error: 'WAHA_AUTH_MISSING' });
  }

  const baseUrl = String(process.env.WAHA_BASE_URL || DEFAULT_WAHA_URL)
    .replace(/\/+$/, '');
  const target = new URL(path, `${baseUrl}/`);
  const allowed = new URL(baseUrl);

  if (
    target.protocol !== allowed.protocol ||
    target.host !== allowed.host ||
    !target.pathname.startsWith('/api/files/')
  ) {
    return sendJson(res, 403, { ok: false, error: 'MEDIA_TARGET_NOT_ALLOWED' });
  }

  const controller = new AbortController();
  const timeoutMs = positiveNumber(
    process.env.MEDIA_PROXY_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  const maxBytes = positiveNumber(
    process.env.MEDIA_PROXY_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const authHeaders = apiKey
      ? { 'X-Api-Key': apiKey }
      : { Authorization: `Bearer ${apiToken}` };
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        ...authHeaders,
        Accept: 'image/jpeg, image/png, image/webp'
      },
      redirect: 'error',
      signal: controller.signal
    });

    if (!response.ok) {
      return sendJson(res, 502, { ok: false, error: 'WAHA_MEDIA_HTTP_ERROR' });
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return sendJson(res, 413, { ok: false, error: 'MEDIA_TOO_LARGE' });
    }

    const mimeType = normalizeMimeType(response.headers.get('content-type'));
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return sendJson(res, 415, { ok: false, error: 'MEDIA_MIME_NOT_ALLOWED' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) {
      return sendJson(res, buffer.length ? 413 : 502, {
        ok: false,
        error: buffer.length ? 'MEDIA_TOO_LARGE' : 'MEDIA_EMPTY'
      });
    }

    res.status(200);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(buffer);
  } catch (error) {
    return sendJson(res, 502, {
      ok: false,
      error: error?.name === 'AbortError'
        ? 'MEDIA_PROXY_TIMEOUT'
        : 'MEDIA_PROXY_FAILED'
    });
  } finally {
    clearTimeout(timeout);
  }
}
