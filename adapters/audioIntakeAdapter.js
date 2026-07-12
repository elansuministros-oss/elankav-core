function firstValue(values) {
  return values.find(value =>
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
  ) ?? null;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function extractPayload(body = {}) {
  return body.payload && typeof body.payload === 'object'
    ? body.payload
    : body;
}

export function extractAudioCandidate(body = {}) {
  const payload = extractPayload(body);

  const rawType = firstValue([
    payload.type,
    payload.messageType,
    payload._data?.type,
    payload.media?.type,
    payload.message?.audioMessage ? 'audio' : null
  ]);

  const mimeType = firstValue([
    payload.mimetype,
    payload.mimeType,
    payload.media?.mimetype,
    payload.media?.mimeType,
    payload.file?.mimetype,
    payload.message?.audioMessage?.mimetype,
    payload._data?.mimetype
  ]);

  const normalizedType = String(rawType || '').toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();

  const isAudio =
    ['audio', 'ptt', 'voice', 'voice_note', 'voicenote'].includes(
      normalizedType
    ) ||
    normalizedMime.startsWith('audio/') ||
    Boolean(payload.message?.audioMessage);

  const messageId = firstValue([
    payload.id?.id,
    typeof payload.id === 'string' ? payload.id : null,
    payload.key?.id,
    payload._data?.id?.id,
    payload.message?.key?.id
  ]);

  const chatId = firstValue([
    payload.from,
    payload.chatId,
    payload.key?.remoteJid,
    payload._data?.from,
    payload.message?.key?.remoteJid
  ]);

  const mediaUrl = firstValue([
    payload.mediaUrl,
    payload.fileUrl,
    payload.media?.url,
    payload.file?.url,
    payload.message?.audioMessage?.url
  ]);

  const mediaReference = firstValue([
    payload.mediaReference,
    payload.media?.id,
    payload.file?.id,
    payload.message?.audioMessage?.directPath,
    payload._data?.mediaData?.filename
  ]);

  const durationSeconds = normalizeNumber(firstValue([
    payload.duration,
    payload.durationSeconds,
    payload.media?.duration,
    payload.message?.audioMessage?.seconds,
    payload._data?.duration
  ]));

  const sizeBytes = normalizeNumber(firstValue([
    payload.size,
    payload.sizeBytes,
    payload.media?.size,
    payload.file?.size,
    payload.message?.audioMessage?.fileLength
  ]));

  const isVoiceNote =
    normalizedType === 'ptt' ||
    normalizedType === 'voice' ||
    Boolean(
      payload.ptt ??
      payload.isVoiceNote ??
      payload.message?.audioMessage?.ptt
    );

  return {
    isAudio,
    event: String(body.event || payload.event || '').toLowerCase() || null,
    session: firstValue([
      body.session,
      payload.session,
      process.env.WAHA_SESSION,
      'ELANKAV'
    ]),
    messageId,
    chatId,
    mediaType: isAudio ? 'audio' : normalizedType || null,
    mimeType: mimeType ? String(mimeType).toLowerCase() : null,
    fileName: firstValue([
      payload.filename,
      payload.fileName,
      payload.media?.filename,
      payload.file?.name
    ]),
    mediaUrl,
    mediaReference,
    durationSeconds,
    sizeBytes,
    isVoiceNote,
    source: 'waha',
    receivedAt: new Date().toISOString()
  };
}
