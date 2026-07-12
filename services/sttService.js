import {
  downloadAudioToTemporaryFile
} from './audioDownloadService.js';

import {
  removeTemporaryFile
} from './tempFileService.js';

import {
  normalizeTranscription
} from './transcriptionNormalizer.js';

import {
  transcribeWithOpenAI
} from '../adapters/openaiSpeechAdapter.js';

function resolveDependencies(overrides = {}) {
  return {
    downloadAudio:
      overrides.downloadAudio ||
      downloadAudioToTemporaryFile,

    transcribe:
      overrides.transcribe ||
      transcribeWithOpenAI,

    removeTemporaryFile:
      overrides.removeTemporaryFile ||
      removeTemporaryFile
  };
}

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    transcription: null,
    cleanup: null,
    ...extra
  };
}

export async function transcribeAudio(
  input = {},
  dependencyOverrides = {}
) {
  if (!input.audio) {
    return failure('STT_AUDIO_INPUT_MISSING');
  }

  const dependencies =
    resolveDependencies(dependencyOverrides);

  if (typeof dependencies.downloadAudio !== 'function') {
    return failure(
      'STT_DOWNLOAD_DEPENDENCY_MISSING'
    );
  }

  if (typeof dependencies.transcribe !== 'function') {
    return failure(
      'STT_PROVIDER_DEPENDENCY_MISSING'
    );
  }

  if (
    typeof dependencies.removeTemporaryFile !==
    'function'
  ) {
    return failure(
      'STT_CLEANUP_DEPENDENCY_MISSING'
    );
  }

  let downloaded = null;
  let result = null;
  let cleanup = null;

  try {
    downloaded =
      await dependencies.downloadAudio(
        input.audio,
        input.downloadOptions || {}
      );

    if (!downloaded?.ok) {
      return failure(
        downloaded?.status ||
        'STT_AUDIO_DOWNLOAD_FAILED',
        {
          download: downloaded || null
        }
      );
    }

    const providerResult =
      await dependencies.transcribe(
        {
          filePath: downloaded.filePath,
          mimeType: downloaded.mimeType,
          language: input.language || null,
          prompt: input.prompt || null
        },
        input.providerOptions || {}
      );

    if (!providerResult?.ok) {
      result = failure(
        providerResult?.status ||
        'STT_PROVIDER_FAILED',
        {
          provider: providerResult || null
        }
      );

      return result;
    }

    const normalized =
      normalizeTranscription(providerResult);

    if (!normalized.ok) {
      result = failure(normalized.status, {
        provider: {
          provider:
            providerResult.provider || null,
          model:
            providerResult.model || null
        }
      });

      return result;
    }

    result = {
      ok: true,
      status: 'STT_TRANSCRIPTION_READY',
      transcription: {
        text: normalized.text,
        language: normalized.language,
        provider: normalized.provider,
        model:
          providerResult.model || null
      },
      download: {
        mimeType: downloaded.mimeType,
        sizeBytes: downloaded.sizeBytes
      },
      cleanup: null
    };

    return result;
  } catch (error) {
    result = failure(
      'STT_UNEXPECTED_ERROR',
      {
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );

    return result;
  } finally {
    if (downloaded?.filePath) {
      try {
        cleanup =
          await dependencies.removeTemporaryFile(
            downloaded.filePath
          );
      } catch {
        cleanup = {
          removed: false,
          reason: 'TEMP_FILE_CLEANUP_FAILED'
        };
      }

      if (result) {
        result.cleanup = cleanup;
      }
    }
  }
}
