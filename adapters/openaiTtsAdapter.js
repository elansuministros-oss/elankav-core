const DEFAULT_ENDPOINT =
  'https://api.openai.com/v1/audio/speech';

const DEFAULT_MODEL =
  'gpt-4o-mini-tts';

const DEFAULT_VOICE =
  'cedar';

const DEFAULT_FORMAT =
  'mp3';

const DEFAULT_SPEED =
  0.96;

const DEFAULT_TIMEOUT_MS =
  120000;

const ALLOWED_FORMATS = new Set([
  'mp3',
  'opus',
  'aac',
  'flac',
  'wav',
  'pcm'
]);

const MIME_TYPES = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm'
};

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseSpeed(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0.25 ||
    number > 4
  ) {
    return null;
  }

  return number;
}

function parseTimeout(value) {
  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : DEFAULT_TIMEOUT_MS;
}

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    provider: 'openai',
    audioBuffer: null,
    ...extra
  };
}

function mapHttpFailure(
  statusCode,
  payload = {}
) {
  const providerError =
    payload?.error || {};

  const details = {
    httpStatus: statusCode,
    providerError: {
      type:
        providerError.type || null,
      code:
        providerError.code || null,
      param:
        providerError.param || null
    }
  };

  if (
    statusCode === 401 ||
    statusCode === 403
  ) {
    return failure(
      'OPENAI_TTS_AUTH_FAILED',
      details
    );
  }

  if (statusCode === 429) {
    return failure(
      'OPENAI_TTS_RATE_LIMITED',
      details
    );
  }

  if (
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return failure(
      'OPENAI_TTS_INVALID_REQUEST',
      details
    );
  }

  return failure(
    'OPENAI_TTS_HTTP_ERROR',
    details
  );
}

async function readErrorPayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function synthesizeWithOpenAI(
  input = {},
  options = {}
) {
  const text =
    normalizeText(input.text);

  if (!text) {
    return failure(
      'OPENAI_TTS_TEXT_MISSING'
    );
  }

  const apiKey =
    options.apiKey ||
    process.env.OPENAI_API_KEY ||
    '';

  if (!apiKey) {
    return failure(
      'OPENAI_TTS_API_KEY_MISSING'
    );
  }

  const model =
    normalizeSlug(
      options.model ||
      input.model ||
      process.env.OPENAI_TTS_MODEL ||
      DEFAULT_MODEL
    );

  if (!model) {
    return failure(
      'OPENAI_TTS_MODEL_MISSING'
    );
  }

  const voice =
    normalizeSlug(
      options.voice ||
      input.voice ||
      process.env.OPENAI_TTS_VOICE ||
      DEFAULT_VOICE
    );

  if (
    !voice ||
    !/^[a-z0-9_-]+$/.test(voice)
  ) {
    return failure(
      'OPENAI_TTS_VOICE_INVALID'
    );
  }

  const format =
    normalizeSlug(
      options.format ||
      input.format ||
      process.env.OPENAI_TTS_FORMAT ||
      DEFAULT_FORMAT
    );

  if (!ALLOWED_FORMATS.has(format)) {
    return failure(
      'OPENAI_TTS_FORMAT_NOT_ALLOWED'
    );
  }

  const speed = parseSpeed(
    options.speed ??
    input.speed ??
    process.env.OPENAI_TTS_SPEED ??
    DEFAULT_SPEED
  );

  if (speed === null) {
    return failure(
      'OPENAI_TTS_SPEED_INVALID'
    );
  }

  const instructions =
    normalizeText(
      options.instructions ||
      input.instructions ||
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      ''
    );

  const endpoint =
    options.endpoint ||
    DEFAULT_ENDPOINT;

  const timeoutMs =
    parseTimeout(
      options.timeoutMs
    );

  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  if (
    typeof fetchImpl !== 'function'
  ) {
    return failure(
      'OPENAI_TTS_FETCH_UNAVAILABLE'
    );
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  const requestBody = {
    model,
    voice,
    input: text,
    response_format: format,
    speed
  };

  if (instructions) {
    requestBody.instructions =
      instructions;
  }

  try {
    const response =
      await fetchImpl(
        endpoint,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(
              requestBody
            ),
          signal:
            controller.signal
        }
      );

    if (!response?.ok) {
      const payload =
        await readErrorPayload(
          response
        );

      return mapHttpFailure(
        response?.status || 500,
        payload
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const audioBuffer =
      Buffer.from(arrayBuffer);

    if (!audioBuffer.length) {
      return failure(
        'OPENAI_TTS_EMPTY_AUDIO'
      );
    }

    return {
      ok: true,
      status:
        'OPENAI_TTS_GENERATED',
      provider: 'openai',
      model,
      voice,
      format,
      speed,
      mimeType:
        MIME_TYPES[format],
      sizeBytes:
        audioBuffer.length,
      audioBuffer
    };
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      return failure(
        'OPENAI_TTS_TIMEOUT'
      );
    }

    return failure(
      'OPENAI_TTS_UNEXPECTED_ERROR',
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
