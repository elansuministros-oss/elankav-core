import { createTemporaryAudioFile } from './tempFileService.js';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_WAHA_BASE_URL = 'https://waha.elankav.com';

const MIME_EXTENSION_MAP = new Map([
  ['audio/ogg', 'oga'],
  ['audio/opus', 'opus'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/aac', 'aac'],
  ['audio/webm', 'webm'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav']
]);

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function normalizeMimeType(value) {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function extensionForMimeType(mimeType) {
  return MIME_EXTENSION_MAP.get(normalizeMimeType(mimeType)) || 'bin';
}

function resolveWahaUrl(mediaUrl, baseUrl) {
  if (!mediaUrl) {
    throw new Error('AUDIO_MEDIA_URL_MISSING');
  }

  const normalizedBase = String(
    baseUrl || DEFAULT_WAHA_BASE_URL
  ).replace(/\/+$/, '');

  const resolved = new URL(mediaUrl, `${normalizedBase}/`);
  const allowed = new URL(normalizedBase);

  if (
    resolved.protocol !== allowed.protocol ||
    resolved.host !== allowed.host
  ) {
    throw new Error('AUDIO_MEDIA_URL_NOT_ALLOWED');
  }

  if (!resolved.pathname.startsWith('/api/files/')) {
    throw new Error('AUDIO_MEDIA_PATH_NOT_ALLOWED');
  }

  return resolved;
}

function resolveAuthHeader({ apiKey, apiToken } = {}) {
  const key = apiKey || process.env.WAHA_API_KEY;
  const token = apiToken || process.env.WAHA_API_TOKEN;

  if (key) {
    return {
      name: 'X-Api-Key',
      value: key
    };
  }

  if (token) {
    return {
      name: 'Authorization',
      value: `Bearer ${token}`
    };
  }

  return null;
}

export async function downloadAudioToTemporaryFile(
  audio = {},
  options = {}
) {
  const mediaUrl = audio.mediaUrl || audio.url || null;
  const mimeType = normalizeMimeType(
    audio.mimeType || audio.mimetype
  );

  if (!mediaUrl) {
    return {
      ok: false,
      status: 'AUDIO_MEDIA_URL_MISSING',
      filePath: null,
      mimeType,
      sizeBytes: null
    };
  }

  const auth = resolveAuthHeader(options);

  if (!auth) {
    return {
      ok: false,
      status: 'WAHA_AUTH_MISSING',
      filePath: null,
      mimeType,
      sizeBytes: null
    };
  }

  let url;

  try {
    url = resolveWahaUrl(
      mediaUrl,
      options.baseUrl ||
        process.env.WAHA_BASE_URL ||
        DEFAULT_WAHA_BASE_URL
    );
  } catch (error) {
    return {
      ok: false,
      status: error?.message || 'AUDIO_MEDIA_URL_INVALID',
      filePath: null,
      mimeType,
      sizeBytes: null
    };
  }

  const timeoutMs = parsePositiveNumber(
    options.timeoutMs || process.env.STT_DOWNLOAD_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );

  const maxBytes = parsePositiveNumber(
    options.maxBytes ||
      process.env.STT_DOWNLOAD_MAX_BYTES ||
      process.env.WAHA_AUDIO_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        [auth.name]: auth.value,
        Accept: 'audio/*, application/octet-stream'
      },
      redirect: 'error',
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 'AUDIO_DOWNLOAD_HTTP_ERROR',
        httpStatus: response.status,
        filePath: null,
        mimeType,
        sizeBytes: null
      };
    }

    const contentLength = Number(
      response.headers.get('content-length')
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > maxBytes
    ) {
      return {
        ok: false,
        status: 'AUDIO_DOWNLOAD_SIZE_EXCEEDED',
        filePath: null,
        mimeType,
        sizeBytes: contentLength
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length === 0) {
      return {
        ok: false,
        status: 'AUDIO_DOWNLOAD_EMPTY',
        filePath: null,
        mimeType,
        sizeBytes: 0
      };
    }

    if (buffer.length > maxBytes) {
      return {
        ok: false,
        status: 'AUDIO_DOWNLOAD_SIZE_EXCEEDED',
        filePath: null,
        mimeType,
        sizeBytes: buffer.length
      };
    }

    const responseMimeType = normalizeMimeType(
      response.headers.get('content-type')
    );

    const finalMimeType =
      responseMimeType || mimeType || 'application/octet-stream';

    const temporary = await createTemporaryAudioFile({
      buffer,
      extension: extensionForMimeType(finalMimeType)
    });

    if (!temporary.ok) {
      return {
        ok: false,
        status: temporary.status,
        filePath: null,
        mimeType: finalMimeType,
        sizeBytes: buffer.length
      };
    }

    return {
      ok: true,
      status: 'AUDIO_DOWNLOADED',
      filePath: temporary.filePath,
      mimeType: finalMimeType,
      sizeBytes: temporary.sizeBytes
    };
  } catch (error) {
    return {
      ok: false,
      status:
        error?.name === 'AbortError'
          ? 'AUDIO_DOWNLOAD_TIMEOUT'
          : 'AUDIO_DOWNLOAD_FAILED',
      filePath: null,
      mimeType,
      sizeBytes: null
    };
  } finally {
    clearTimeout(timeout);
  }
}
