const DEFAULT_TIMEOUT_MS = 10000;

function getConfig() {
  return {
    baseUrl: String(process.env.WAHA_BASE_URL || '').replace(/\/$/, ''),
    apiKey: String(process.env.WAHA_API_KEY || ''),
    session: String(process.env.WAHA_SESSION || 'default'),
  };
}

function createHeaders() {
  const { apiKey } = getConfig();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  return headers;
}

function assertConfig(config) {
  if (!config.baseUrl) {
    throw new Error('WAHA_BASE_URL no configurado');
  }

  if (!config.session) {
    throw new Error('WAHA_SESSION no configurado');
  }
}

async function requestJson(path, options = {}) {
  const config = getConfig();
  assertConfig(config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...createHeaders(),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.message || data?.error || 'WAHA request failed',
        data,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendText({ chatId, text }) {
  const config = getConfig();
  assertConfig(config);

  if (!chatId) throw new Error('chatId requerido');
  if (!text) throw new Error('text requerido');

  return requestJson('/api/sendText', {
    method: 'POST',
    body: {
      session: config.session,
      chatId,
      text,
    },
  });
}

export async function sendFile({ chatId, fileUrl, caption = '' }) {
  const config = getConfig();
  assertConfig(config);

  if (!chatId) throw new Error('chatId requerido');
  if (!fileUrl) throw new Error('fileUrl requerido');

  return requestJson('/api/sendFile', {
    method: 'POST',
    body: {
      session: config.session,
      chatId,
      file: {
        url: fileUrl,
      },
      caption,
    },
  });
}

export async function getSessionStatus() {
  const config = getConfig();
  assertConfig(config);

  const primary = await requestJson(`/api/sessions/${encodeURIComponent(config.session)}`);
  if (primary.ok) return primary;

  const fallback = await requestJson(`/api/sessions/${encodeURIComponent(config.session)}/status`);
  return {
    ...fallback,
    fallbackTried: true,
    primaryError: primary.error,
  };
}

export function getWahaRuntimeConfig() {
  const config = getConfig();

  return {
    hasBaseUrl: Boolean(config.baseUrl),
    hasApiKey: Boolean(config.apiKey),
    session: config.session || null,
  };
}
