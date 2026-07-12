import {
  synthesizeWithOpenAI
} from '../adapters/openaiTtsAdapter.js';

const DEFAULT_PROFILE =
  'elan-ia-official-v1';

const DEFAULT_LANGUAGE =
  'es-419';

const DEFAULT_INSTRUCTIONS = [
  'Habla en español latino natural y entendible en Nicaragua.',
  'Usa una voz masculina, cercana, segura, elegante, profesional y empática.',
  'Mantén un ritmo conversacional.',
  'Evita sonar como locutor de radio o como una voz robótica.',
  'Pronuncia ELAN IA como Elán I A.'
].join(' ');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    profile: null,
    language: null,
    audio: null,
    ...extra
  };
}

function resolveVoiceProfile(input = {}) {
  return {
    profile:
      input.profile ||
      process.env.ELAN_VOICE_PROFILE ||
      DEFAULT_PROFILE,

    language:
      input.language ||
      process.env.ELAN_VOICE_LANGUAGE ||
      DEFAULT_LANGUAGE,

    model:
      input.model ||
      process.env.OPENAI_TTS_MODEL ||
      'gpt-4o-mini-tts',

    voice:
      input.voice ||
      process.env.OPENAI_TTS_VOICE ||
      'cedar',

    format:
      input.format ||
      process.env.OPENAI_TTS_FORMAT ||
      'mp3',

    speed:
      input.speed ??
      process.env.OPENAI_TTS_SPEED ??
      0.96,

    instructions:
      input.instructions ||
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      DEFAULT_INSTRUCTIONS
  };
}

export async function generateVoiceResponse(
  input = {},
  dependencies = {}
) {
  const text = normalizeText(input.text);

  if (!text) {
    return failure(
      'TTS_TEXT_MISSING'
    );
  }

  const synthesize =
    dependencies.synthesize ||
    synthesizeWithOpenAI;

  if (
    typeof synthesize !== 'function'
  ) {
    return failure(
      'TTS_PROVIDER_DEPENDENCY_MISSING'
    );
  }

  const profile =
    resolveVoiceProfile(input);

  try {
    const providerResult =
      await synthesize(
        {
          text,
          model: profile.model,
          voice: profile.voice,
          format: profile.format,
          speed: profile.speed,
          instructions:
            profile.instructions
        },
        dependencies.providerOptions || {}
      );

    if (!providerResult?.ok) {
      return failure(
        providerResult?.status ||
        'TTS_PROVIDER_FAILED',
        {
          profile:
            profile.profile,
          language:
            profile.language,
          provider:
            providerResult?.provider ||
            null,
          providerResult
        }
      );
    }

    if (
      !Buffer.isBuffer(
        providerResult.audioBuffer
      ) ||
      !providerResult.audioBuffer.length
    ) {
      return failure(
        'TTS_AUDIO_EMPTY',
        {
          profile:
            profile.profile,
          language:
            profile.language
        }
      );
    }

    return {
      ok: true,
      status: 'TTS_AUDIO_READY',
      profile:
        profile.profile,
      language:
        profile.language,
      provider:
        providerResult.provider,
      model:
        providerResult.model,
      voice:
        providerResult.voice,
      audio: {
        buffer:
          providerResult.audioBuffer,
        mimeType:
          providerResult.mimeType,
        format:
          providerResult.format,
        sizeBytes:
          providerResult.sizeBytes,
        fileName:
          `elan-ia-${Date.now()}.${providerResult.format}`
      }
    };
  } catch (error) {
    return failure(
      'TTS_UNEXPECTED_ERROR',
      {
        profile:
          profile.profile,
        language:
          profile.language,
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  }
}

export {
  resolveVoiceProfile
};
