import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_OPENAI_URL =
  'https://api.openai.com/v1/audio/transcriptions';

const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_TIMEOUT_MS = 60_000;

const ALLOWED_MODELS = new Set([
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  'gpt-4o-mini-transcribe-2025-12-15',
  'whisper-1'
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

function normalizeLanguage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!/^[a-z]{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function resolveModel(value) {
  const model = String(
    value ||
    process.env.OPENAI_STT_MODEL ||
    DEFAULT_MODEL
  ).trim();

  return ALLOWED_MODELS.has(model)
    ? model
    : null;
}

function safeFileName(filePath, mimeType) {
  const original = path.basename(
    String(filePath || 'audio.bin')
  );

  const cleaned = original.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  const normalizedMimeType =
    normalizeMimeType(mimeType);

  if (cleaned && cleaned !== '.') {
    if (
      normalizedMimeType === 'audio/ogg' &&
      cleaned.toLowerCase().endsWith('.oga')
    ) {
      return `${cleaned.slice(0, -4)}.ogg`;
    }

    return cleaned;
  }

  const extension = (() => {
    switch (normalizeMimeType(mimeType)) {
      case 'audio/ogg':
        return 'oga';
      case 'audio/opus':
        return 'opus';
      case 'audio/mpeg':
        return 'mp3';
      case 'audio/mp4':
        return 'm4a';
      case 'audio/aac':
        return 'aac';
      case 'audio/webm':
        return 'webm';
      case 'audio/wav':
      case 'audio/x-wav':
        return 'wav';
      default:
        return 'bin';
    }
  })();

  return `audio.${extension}`;
}

function normalizeProviderError(httpStatus, payload) {
  if (httpStatus === 401 || httpStatus === 403) {
    return 'OPENAI_SPEECH_AUTH_FAILED';
  }

  if (httpStatus === 413) {
    return 'OPENAI_SPEECH_FILE_TOO_LARGE';
  }

  if (httpStatus === 429) {
    return 'OPENAI_SPEECH_RATE_LIMITED';
  }

  if (httpStatus >= 500) {
    return 'OPENAI_SPEECH_UNAVAILABLE';
  }

  const providerCode = String(
    payload?.error?.code ||
    payload?.code ||
    ''
  ).toLowerCase();

  if (providerCode.includes('invalid_api_key')) {
    return 'OPENAI_SPEECH_AUTH_FAILED';
  }

  return 'OPENAI_SPEECH_HTTP_ERROR';
}

export async function transcribeWithOpenAI(
  input = {},
  options = {}
) {
  const filePath = input.filePath || null;
  const mimeType = normalizeMimeType(
    input.mimeType || 'application/octet-stream'
  );

  if (!filePath) {
    return {
      ok: false,
      status: 'OPENAI_SPEECH_FILE_MISSING',
      text: null,
      language: null,
      provider: 'openai'
    };
  }

  const apiKey =
    options.apiKey ||
    process.env.OPENAI_API_KEY ||
    null;

  if (!apiKey) {
    return {
      ok: false,
      status: 'OPENAI_SPEECH_API_KEY_MISSING',
      text: null,
      language: null,
      provider: 'openai'
    };
  }

  const model = resolveModel(options.model);

  if (!model) {
    return {
      ok: false,
      status: 'OPENAI_SPEECH_MODEL_NOT_ALLOWED',
      text: null,
      language: null,
      provider: 'openai'
    };
  }

  let fileBuffer;

  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (error) {
    return {
      ok: false,
      status:
        error?.code === 'ENOENT'
          ? 'OPENAI_SPEECH_FILE_NOT_FOUND'
          : 'OPENAI_SPEECH_FILE_READ_FAILED',
      text: null,
      language: null,
      provider: 'openai'
    };
  }

  if (fileBuffer.length === 0) {
    return {
      ok: false,
      status: 'OPENAI_SPEECH_FILE_EMPTY',
      text: null,
      language: null,
      provider: 'openai'
    };
  }

  const timeoutMs = parsePositiveNumber(
    options.timeoutMs ||
    process.env.OPENAI_STT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );

  const endpoint =
    options.endpoint ||
    process.env.OPENAI_STT_ENDPOINT ||
    DEFAULT_OPENAI_URL;

  const language = normalizeLanguage(
    input.language ||
    options.language ||
    process.env.OPENAI_STT_LANGUAGE
  );

  const form = new FormData();

  form.append(
    'file',
    new Blob(
      [fileBuffer],
      {
        type: mimeType
      }
    ),
    safeFileName(filePath, mimeType)
  );

  form.append('model', model);
  form.append('response_format', 'json');

  if (language) {
    form.append('language', language);
  }

  const prompt = String(
    input.prompt ||
    options.prompt ||
    process.env.OPENAI_STT_PROMPT ||
    ''
  ).trim();

  if (prompt) {
    form.append('prompt', prompt);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      body: form,
      redirect: 'error',
      signal: controller.signal
    });

    let payload;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: normalizeProviderError(
          response.status,
          payload
        ),
        httpStatus: response.status,
        text: null,
        language,
        provider: 'openai',
        model
      };
    }

    const text = String(
      payload?.text || ''
    ).trim();

    if (!text) {
      return {
        ok: false,
        status: 'OPENAI_SPEECH_EMPTY_RESPONSE',
        text: null,
        language,
        provider: 'openai',
        model
      };
    }

    return {
      ok: true,
      status: 'OPENAI_SPEECH_TRANSCRIBED',
      text,
      language:
        payload?.language ||
        language ||
        null,
      provider: 'openai',
      model
    };
  } catch (error) {
    return {
      ok: false,
      status:
        error?.name === 'AbortError'
          ? 'OPENAI_SPEECH_TIMEOUT'
          : 'OPENAI_SPEECH_REQUEST_FAILED',
      text: null,
      language,
      provider: 'openai',
      model
    };
  } finally {
    clearTimeout(timeout);
  }
}
