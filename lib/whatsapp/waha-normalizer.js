function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();

  if (typeof value === 'number') {
    const millis = value > 9999999999 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizePayload(event = {}) {
  return event.payload || event.message || event.data || event;
}

export function normalizeWahaEvent(event = {}) {
  const payload = normalizePayload(event);
  const message = payload.message || payload;
  const fromMe = Boolean(firstDefined(message.fromMe, payload.fromMe, false));
  const body = firstDefined(
    message.body,
    message.text,
    message.caption,
    payload.body,
    payload.text,
    payload.caption,
    ''
  );

  const chatId = firstDefined(
    message.chatId,
    message.from,
    message.to,
    payload.chatId,
    payload.from,
    payload.to,
    ''
  );

  const normalized = {
    source: 'WAHA',
    event: firstDefined(event.event, event.type, payload.event, payload.type, 'unknown'),
    session: firstDefined(event.session, payload.session, ''),
    messageId: firstDefined(message.id, message._data?.id?.id, payload.id, ''),
    chatId,
    from: firstDefined(message.from, payload.from, chatId),
    to: firstDefined(message.to, payload.to, ''),
    fromMe,
    type: firstDefined(message.type, payload.type, 'unknown'),
    body: String(body || '').trim(),
    hasMedia: Boolean(firstDefined(message.hasMedia, payload.hasMedia, false)),
    timestamp: normalizeTimestamp(firstDefined(message.timestamp, payload.timestamp, event.timestamp)),
    raw: event,
  };

  return {
    ...normalized,
    isMessage: Boolean(normalized.messageId || normalized.body || normalized.chatId),
    isInbound: !normalized.fromMe,
    isLeadCandidate: !normalized.fromMe && Boolean(normalized.body) && Boolean(normalized.chatId),
  };
}

export function isValidWahaEvent(event = {}) {
  if (!event || typeof event !== 'object') return false;

  const normalized = normalizeWahaEvent(event);
  return Boolean(normalized.event || normalized.chatId || normalized.body || normalized.messageId);
}
