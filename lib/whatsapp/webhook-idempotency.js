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
  const hasReplyableContent =
    Boolean(normalized.body) ||
    Boolean(normalized.hasMedia) ||
    ['image', 'audio', 'ptt', 'voice', 'document', 'file', 'location'].includes(String(normalized.type || '').toLowerCase());

  return (
    normalized.event === 'message' &&
    normalized.isInbound &&
    !normalized.fromMe &&
    Boolean(normalized.chatId) &&
    hasReplyableContent
  );
}

export function getAutoReplySkipReason(normalized = {}) {
  if (normalized.event !== 'message') return 'Evento WAHA ignorado para respuesta automatica';
  if (normalized.fromMe || !normalized.isInbound) return 'Mensaje enviado por ELAN/WAHA';
  if (!normalized.chatId) return 'Mensaje sin chatId';
  if (!normalized.body && !normalized.hasMedia) return 'Mensaje sin texto o archivo';
  return '';
}

export function getWebhookReplyKeys(normalized = {}) {
  const fingerprint =
    normalized.chatId && normalized.timestamp
      ? `fingerprint:${normalized.chatId}:${normalized.body || normalized.type || 'media'}:${normalized.timestamp}`
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
