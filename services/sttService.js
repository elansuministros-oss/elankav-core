import { normalizeTranscription } from './transcriptionNormalizer.js';

export async function transcribeAudio(input = {}, dependencies = {}) {
  if (!input.audio) {
    return {
      ok: false,
      status: 'STT_AUDIO_INPUT_MISSING',
      transcription: null
    };
  }

  if (typeof dependencies.downloadAudio !== 'function') {
    return {
      ok: false,
      status: 'STT_DOWNLOAD_DEPENDENCY_MISSING',
      transcription: null
    };
  }

  if (typeof dependencies.transcribe !== 'function') {
    return {
      ok: false,
      status: 'STT_PROVIDER_DEPENDENCY_MISSING',
      transcription: null
    };
  }

  const downloaded = await dependencies.downloadAudio(input.audio);

  if (!downloaded?.ok) {
    return {
      ok: false,
      status: downloaded?.status || 'STT_AUDIO_DOWNLOAD_FAILED',
      transcription: null
    };
  }

  const providerResult = await dependencies.transcribe({
    filePath: downloaded.filePath,
    mimeType: downloaded.mimeType,
    language: input.language || null
  });

  if (!providerResult?.ok) {
    return {
      ok: false,
      status: providerResult?.status || 'STT_PROVIDER_FAILED',
      transcription: null
    };
  }

  const normalized = normalizeTranscription(providerResult);

  return {
    ok: normalized.ok,
    status: normalized.status,
    transcription: normalized
  };
}
