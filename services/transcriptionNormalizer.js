function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTranscription(input = {}) {
  const text = normalizeWhitespace(input.text);

  if (!text) {
    return {
      ok: false,
      status: 'STT_EMPTY_TRANSCRIPTION',
      text: '',
      language: input.language || null,
      provider: input.provider || null
    };
  }

  return {
    ok: true,
    status: 'STT_TRANSCRIPTION_READY',
    text,
    language: input.language || null,
    provider: input.provider || null
  };
}
