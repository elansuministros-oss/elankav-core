const DEFAULT_WAHA_URL = 'https://waha.elankav.com';
const DEFAULT_SESSION = 'ELANKAV';
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp'
]);

function normalizeWhatsapp(value) {
  return String(value || '').replace(/\D/g, '');
}

async function sendDesignImageToWhatsApp({
  whatsapp,
  requestCode,
  bytes,
  mimeType = 'image/png',
  fetchImpl = globalThis.fetch
} = {}) {
  const phone = normalizeWhatsapp(whatsapp);
  const normalizedMime = String(mimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const apiKey = String(
    process.env.WAHA_API_KEY || process.env.WAHA_API_TOKEN || ''
  ).trim();

  if (phone.length < 8 || phone.length > 15) {
    const error = new Error('WhatsApp de entrega inválido');
    error.code = 'DESIGN_DELIVERY_PHONE_INVALID';
    throw error;
  }

  if (!Buffer.isBuffer(bytes) || !bytes.length || !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    const error = new Error('Imagen de entrega inválida');
    error.code = 'DESIGN_DELIVERY_IMAGE_INVALID';
    throw error;
  }

  if (!apiKey) {
    const error = new Error('WAHA no configurado para entrega');
    error.code = 'DESIGN_DELIVERY_WAHA_NOT_CONFIGURED';
    throw error;
  }

  const baseUrl = String(process.env.WAHA_BASE_URL || DEFAULT_WAHA_URL)
    .replace(/\/+$/, '');
  const session = String(process.env.WAHA_SESSION || DEFAULT_SESSION).trim();
  const extension = normalizedMime === 'image/jpeg'
    ? 'jpg'
    : normalizedMime.split('/')[1];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetchImpl(`${baseUrl}/api/sendImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({
        session,
        chatId: `${phone}@c.us`,
        file: {
          mimetype: normalizedMime,
          filename: `${requestCode}.${extension}`,
          data: bytes.toString('base64')
        },
        caption: `Tu propuesta visual ${requestCode} está lista. Podemos continuar con los ajustes por este WhatsApp.`
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = new Error(`WAHA HTTP ${response.status}`);
      error.code = 'DESIGN_DELIVERY_WAHA_FAILED';
      throw error;
    }

    return Object.freeze({ delivered: true });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('WAHA agotó el tiempo de entrega');
      timeoutError.code = 'DESIGN_DELIVERY_WAHA_TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  normalizeWhatsapp,
  sendDesignImageToWhatsApp
};
