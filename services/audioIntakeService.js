const DEFAULT_ALLOWED_MIME_TYPES = [
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
  'audio/wav',
  'audio/x-wav'
];

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_DURATION_SECONDS = 300;

function parsePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}

function allowedMimeTypes() {
  const configured = String(
    process.env.WAHA_AUDIO_ALLOWED_MIME_TYPES || ''
  )
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.length
    ? configured
    : DEFAULT_ALLOWED_MIME_TYPES;
}

export function validateAudioIntake(candidate = {}) {
  if (!candidate.isAudio) {
    return {
      accepted: false,
      status: 'AUDIO_IGNORED',
      reason: 'NOT_AUDIO'
    };
  }

  if (!candidate.messageId || !candidate.chatId) {
    return {
      accepted: false,
      status: 'AUDIO_METADATA_INCOMPLETE',
      reason: 'MESSAGE_ID_OR_CHAT_ID_MISSING'
    };
  }

  if (!candidate.mimeType) {
    return {
      accepted: false,
      status: 'AUDIO_METADATA_INCOMPLETE',
      reason: 'MIME_TYPE_MISSING'
    };
  }

  if (!allowedMimeTypes().includes(candidate.mimeType)) {
    return {
      accepted: false,
      status: 'AUDIO_TYPE_NOT_ALLOWED',
      reason: 'MIME_TYPE_NOT_ALLOWED'
    };
  }

  if (!candidate.mediaUrl && !candidate.mediaReference) {
    return {
      accepted: false,
      status: 'AUDIO_REFERENCE_MISSING',
      reason: 'MEDIA_REFERENCE_MISSING'
    };
  }

  const maxBytes = parsePositiveNumber(
    process.env.WAHA_AUDIO_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );

  if (
    candidate.sizeBytes !== null &&
    candidate.sizeBytes > maxBytes
  ) {
    return {
      accepted: false,
      status: 'AUDIO_SIZE_EXCEEDED',
      reason: 'MAX_BYTES_EXCEEDED'
    };
  }

  const maxDuration = parsePositiveNumber(
    process.env.WAHA_AUDIO_MAX_DURATION_SECONDS,
    DEFAULT_MAX_DURATION_SECONDS
  );

  if (
    candidate.durationSeconds !== null &&
    candidate.durationSeconds > maxDuration
  ) {
    return {
      accepted: false,
      status: 'AUDIO_DURATION_EXCEEDED',
      reason: 'MAX_DURATION_EXCEEDED'
    };
  }

  return {
    accepted: true,
    status: 'AUDIO_ACCEPTED',
    reason: null,
    audio: {
      messageId: candidate.messageId,
      chatId: candidate.chatId,
      mediaType: candidate.mediaType,
      mimeType: candidate.mimeType,
      fileName: candidate.fileName,
      durationSeconds: candidate.durationSeconds,
      sizeBytes: candidate.sizeBytes,
      isVoiceNote: candidate.isVoiceNote,
      source: candidate.source,
      receivedAt: candidate.receivedAt,
      hasMediaUrl: Boolean(candidate.mediaUrl),
      hasMediaReference: Boolean(candidate.mediaReference)
    }
  };
}
