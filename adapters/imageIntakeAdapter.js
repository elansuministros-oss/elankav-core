function firstValue(values) {
  return values.find(value =>
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
  ) ?? null;
}

function extractPayload(body = {}) {
  return body.payload && typeof body.payload === 'object'
    ? body.payload
    : body;
}

function normalizeMimeType(value) {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

export function extractImageCandidate(body = {}) {
  const payload = extractPayload(body);
  const rawType = firstValue([
    payload.type,
    payload.messageType,
    payload._data?.type,
    payload.media?.type,
    payload.message?.imageMessage ? 'image' : null
  ]);
  const mimeType = normalizeMimeType(firstValue([
    payload.mimetype,
    payload.mimeType,
    payload.media?.mimetype,
    payload.media?.mimeType,
    payload.file?.mimetype,
    payload.message?.imageMessage?.mimetype,
    payload._data?.mimetype
  ]));
  const normalizedType = String(rawType || '').trim().toLowerCase();

  return Object.freeze({
    isImage:
      normalizedType === 'image' ||
      mimeType.startsWith('image/') ||
      Boolean(payload.message?.imageMessage),
    messageId: firstValue([
      payload.id?.id,
      typeof payload.id === 'string' ? payload.id : null,
      payload.key?.id,
      payload._data?.id?.id,
      payload.message?.key?.id
    ]),
    mediaUrl: firstValue([
      payload.media?.url,
      payload.mediaUrl,
      payload.fileUrl,
      payload.file?.url
    ]),
    mimeType: mimeType || null,
    fileName: firstValue([
      payload.media?.filename,
      payload.filename,
      payload.fileName,
      payload.file?.name
    ]),
    source: 'waha'
  });
}
