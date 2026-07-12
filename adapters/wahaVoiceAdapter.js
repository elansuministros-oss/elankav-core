const DEFAULT_BASE_URL =
  'http://127.0.0.1:3000';

const DEFAULT_SESSION =
  'ELANKAV';

const DEFAULT_ENDPOINT =
  '/api/sendVoice';

const DEFAULT_TIMEOUT_MS =
  120000;

function normalizeText(value) {
  return String(value || '')
    .trim();
}

function normalizeBaseUrl(value) {
  return normalizeText(value)
    .replace(/\/+$/, '');
}

function normalizeChatId(value) {
  const raw =
    normalizeText(value);

  if (!raw) {
    return '';
  }

  if (raw.includes('@')) {
    return raw;
  }

  const digits =
    raw.replace(/\D/g, '');

  return digits
    ? `${digits}@c.us`
    : '';
}

function parseTimeout(value) {
  const number =
    Number(value);

  return Number.isFinite(number) &&
    number > 0
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

async function readResponsePayload(
  response
) {
  try {
    return await response.json();
  } catch {
    try {
      return {
        raw:
          await response.text()
      };
    } catch {
      return {};
    }
  }
}

function mapHttpFailure(
  statusCode,
  payload = {}
) {
  const details = {
    httpStatus:
      statusCode,
    providerError:
      payload?.error ||
      payload?.message ||
      null
  };

  if (
    statusCode === 401 ||
    statusCode === 403
  ) {
    return failure(
      'WAHA_VOICE_AUTH_FAILED',
      details
    );
  }

  if (statusCode === 404) {
    return failure(
      'WAHA_VOICE_ENDPOINT_NOT_FOUND',
      details
    );
  }

  if (statusCode === 429) {
    return failure(
      'WAHA_VOICE_RATE_LIMITED',
      details
    );
  }

  if (
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return failure(
      'WAHA_VOICE_INVALID_REQUEST',
      details
    );
  }

  return failure(
    'WAHA_VOICE_HTTP_ERROR',
    details
  );
}

export async function sendVoiceWithWaha(
  input = {},
  options = {}
) {
  const chatId =
    normalizeChatId(
      input.chatId
    );

  if (!chatId) {
    return failure(
      'WAHA_VOICE_CHAT_ID_MISSING'
    );
  }

  const audioBuffer =
    input.audioBuffer ||
    input.audio?.buffer ||
    null;

  if (
    !Buffer.isBuffer(audioBuffer) ||
    !audioBuffer.length
  ) {
    return failure(
      'WAHA_VOICE_AUDIO_MISSING'
    );
  }

  const apiKey =
    options.apiKey ||
    process.env.WAHA_API_KEY ||
    '';

  if (!apiKey) {
    return failure(
      'WAHA_VOICE_API_KEY_MISSING'
    );
  }

  const session =
    normalizeText(
      input.session ||
      options.session ||
      process.env.WAHA_SESSION ||
      DEFAULT_SESSION
    );

  if (!session) {
    return failure(
      'WAHA_VOICE_SESSION_MISSING'
    );
  }

  const mimeType =
    normalizeText(
      input.mimeType ||
      input.audio?.mimeType ||
      'audio/mpeg'
    );

  const fileName =
    normalizeText(
      input.fileName ||
      input.audio?.fileName ||
      'elan-ia-voice.mp3'
    );

  const baseUrl =
    normalizeBaseUrl(
      options.baseUrl ||
      process.env.WAHA_INTERNAL_URL ||
      DEFAULT_BASE_URL
    );

  const endpoint =
    normalizeText(
      options.endpoint ||
      DEFAULT_ENDPOINT
    );

  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  if (
    typeof fetchImpl !== 'function'
  ) {
    return failure(
      'WAHA_VOICE_FETCH_UNAVAILABLE'
    );
  }

  const timeoutMs =
    parseTimeout(
      options.timeoutMs
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  const payload = {
    session,
    chatId,
    file: {
      mimetype: mimeType,
      filename: fileName,
      data:
        audioBuffer.toString(
          'base64'
        )
    },
    convert: true
  };

  try {
    const response =
      await fetchImpl(
        `${baseUrl}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'X-Api-Key':
              apiKey,
            Accept:
              'application/json',
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(payload),
          signal:
            controller.signal
        }
      );

    const responsePayload =
      await readResponsePayload(
        response
      );

    if (!response?.ok) {
      return mapHttpFailure(
        response?.status || 500,
        responsePayload
      );
    }

    const messageId =
      resolveMessageId(
        responsePayload
      );

    return {
      ok: true,
      status:
        'WAHA_VOICE_SENT',
      provider: 'waha',
      session,
      chatId,
      messageId,
      mimeType,
      fileName,
      sizeBytes:
        audioBuffer.length
    };
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      return failure(
        'WAHA_VOICE_TIMEOUT'
      );
    }

    return failure(
      'WAHA_VOICE_UNEXPECTED_ERROR',
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
