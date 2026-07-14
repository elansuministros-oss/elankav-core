const DEFAULT_BASE_URL =
  'https://waha.elankav.com';

const DEFAULT_SESSION =
  'ELANKAV';

const DEFAULT_ENDPOINT =
  '/api/sendImage';

const DEFAULT_TIMEOUT_MS =
  120000;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeBaseUrl(value) {
  return normalizeText(value)
    .replace(/\/+$/, '');
}

function normalizeChatId(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return '';
  }

  if (raw.includes('@')) {
    return raw;
  }

  const digits = raw.replace(/\D/g, '');

  return digits
    ? `${digits}@c.us`
    : '';
}

function parseTimeout(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : DEFAULT_TIMEOUT_MS;
}

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    provider: 'waha',
    messageId: null,
    ...extra
  };
}

function resolveMessageId(payload = {}) {
  return (
    payload?.id?._serialized ||
    payload?.id?.id ||
    payload?.id ||
    payload?.key?.id ||
    payload?.messageId ||
    null
  );
}

async function readResponsePayload(response) {
  try {
    return await response.json();
  } catch {
    try {
      return {
        raw: await response.text()
      };
    } catch {
      return {};
    }
  }
}

function mapHttpFailure(statusCode, payload = {}) {
  const details = {
    httpStatus: statusCode,
    providerError:
      payload?.error ||
      payload?.message ||
      null
  };

  if (statusCode === 401 || statusCode === 403) {
    return failure(
      'WAHA_IMAGE_AUTH_FAILED',
      details
    );
  }

  if (statusCode === 404) {
    return failure(
      'WAHA_IMAGE_ENDPOINT_NOT_FOUND',
      details
    );
  }

  if (statusCode === 429) {
    return failure(
      'WAHA_IMAGE_RATE_LIMITED',
      details
    );
  }

  if (statusCode >= 400 && statusCode < 500) {
    return failure(
      'WAHA_IMAGE_INVALID_REQUEST',
      details
    );
  }

  return failure(
    'WAHA_IMAGE_HTTP_ERROR',
    details
  );
}

export async function sendImageWithWaha(
  input = {},
  options = {}
) {
  const chatId = normalizeChatId(input.chatId);

  if (!chatId) {
    return failure('WAHA_IMAGE_CHAT_ID_MISSING');
  }

  const imageBuffer =
    input.imageBuffer ||
    input.image?.buffer ||
    null;

  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
    return failure('WAHA_IMAGE_DATA_MISSING');
  }

  const apiKey =
    options.apiKey ||
    globalThis.process?.env?.WAHA_API_KEY ||
    globalThis.process?.env?.WAHA_API_TOKEN ||
    '';

  if (!apiKey) {
    return failure('WAHA_IMAGE_API_KEY_MISSING');
  }

  const session = normalizeText(
    input.session ||
    options.session ||
    globalThis.process?.env?.WAHA_SESSION ||
    DEFAULT_SESSION
  );

  if (!session) {
    return failure('WAHA_IMAGE_SESSION_MISSING');
  }

  const baseUrl = normalizeBaseUrl(
    options.baseUrl ||
    globalThis.process?.env?.WAHA_BASE_URL ||
    globalThis.process?.env?.WAHA_INTERNAL_URL ||
    DEFAULT_BASE_URL
  );

  const endpoint = normalizeText(
    options.endpoint ||
    DEFAULT_ENDPOINT
  );

  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    return failure('WAHA_IMAGE_FETCH_UNAVAILABLE');
  }

  const timeoutMs = parseTimeout(options.timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  const fileName = normalizeText(
    input.fileName ||
    input.image?.fileName ||
    'elanvisual-design.jpg'
  );

  const caption = normalizeText(input.caption);
  const payload = {
    session,
    chatId,
    file: {
      mimetype: 'image/jpeg',
      filename: fileName,
      data: imageBuffer.toString('base64')
    },
    caption
  };

  try {
    const response = await fetchImpl(
      `${baseUrl}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    const responsePayload =
      await readResponsePayload(response);

    if (!response?.ok) {
      return mapHttpFailure(
        response?.status || 500,
        responsePayload
      );
    }

    return {
      ok: true,
      status: 'WAHA_IMAGE_SENT',
      provider: 'waha',
      session,
      chatId,
      messageId: resolveMessageId(responsePayload),
      mimeType: 'image/jpeg',
      fileName,
      sizeBytes: imageBuffer.length
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return failure('WAHA_IMAGE_TIMEOUT');
    }

    return failure(
      'WAHA_IMAGE_UNEXPECTED_ERROR',
      {
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
import { Buffer } from 'node:buffer';
