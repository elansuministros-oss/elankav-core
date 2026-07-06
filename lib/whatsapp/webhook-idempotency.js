const DEFAULT_TTL_MS = 10 * 60 * 1000;
const STORE_KEY = '__ELAN_WA_WEBHOOK_REPLY_KEYS__';

function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map();
  }

  return globalThis[STORE_KEY];
}

function cleanupExpired(store, now) {
  for (const [key, expiresAt] of store.entries()) {
    if (expiresAt <= now) store.delete(key);
  }
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function isAutoReplyEvent(normalized = {}) {
  return (
    normalized.event === 'message' &&
    normalized.isInbound &&
    !normalized.fromMe &&
    Boolean(normalized.chatId) &&
    Boolean(normalized.body)
  );
}

export function getAutoReplySkipReason(normalized = {}) {
  if (normalized.event !== 'message') return 'Evento WAHA ignorado para respuesta automatica';
  if (normalized.fromMe || !normalized.isInbound) return 'Mensaje enviado por ELAN/WAHA';
  if (!normalized.chatId || !normalized.body) return 'Mensaje sin chatId o texto';
  return '';
}

export function getWebhookReplyKeys(normalized = {}) {
  const fingerprint =
    normalized.chatId && normalized.body && normalized.timestamp
      ? `fingerprint:${normalized.chatId}:${normalized.body}:${normalized.timestamp}`
      : '';

  return unique([
    normalized.messageId ? `messageId:${normalized.messageId}` : '',
    normalized.eventId ? `eventId:${normalized.eventId}` : '',
    fingerprint,
  ]);
}

export function checkAndRememberWebhookReply(normalized = {}, { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = getStore();
  cleanupExpired(store, now);

  const keys = getWebhookReplyKeys(normalized);
  const duplicateKey = keys.find((key) => store.has(key));

  if (duplicateKey) {
    return {
      duplicate: true,
      duplicateKey,
      keys,
    };
  }

  const expiresAt = now + ttlMs;
  keys.forEach((key) => store.set(key, expiresAt));

  return {
    duplicate: false,
    duplicateKey: '',
    keys,
  };
}

export function clearWebhookReplyMemory() {
  getStore().clear();
}
