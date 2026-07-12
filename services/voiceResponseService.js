import {
  generateVoiceResponse
} from './ttsService.js';

import {
  sendVoiceWithWaha
} from '../adapters/wahaVoiceAdapter.js';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    generated: false,
    sent: false,
    audio: null,
    delivery: null,
    ...extra
  };
}

export async function deliverVoiceResponse(
  input = {},
  dependencies = {}
) {
  const text =
    normalizeText(input.text);

  if (!text) {
    return failure(
      'VOICE_RESPONSE_TEXT_MISSING'
    );
  }

  const chatId =
    String(input.chatId || '')
      .trim();

  if (!chatId) {
    return failure(
      'VOICE_RESPONSE_CHAT_ID_MISSING'
    );
  }

  const generateVoice =
    dependencies.generateVoice ||
    generateVoiceResponse;

  const sendVoice =
    dependencies.sendVoice ||
    sendVoiceWithWaha;

  if (
    typeof generateVoice !== 'function'
  ) {
    return failure(
      'VOICE_RESPONSE_TTS_DEPENDENCY_MISSING'
    );
  }

  if (
    typeof sendVoice !== 'function'
  ) {
    return failure(
      'VOICE_RESPONSE_WAHA_DEPENDENCY_MISSING'
    );
  }

  let generated;

  try {
    generated =
      await generateVoice(
        {
          text,
          profile:
            input.profile,
          language:
            input.language,
          model:
            input.model,
          voice:
            input.voice,
          format:
            input.format,
          speed:
            input.speed,
          instructions:
            input.instructions
        },
        dependencies.ttsDependencies || {}
      );
  } catch (error) {
    return failure(
      'VOICE_RESPONSE_TTS_UNEXPECTED_ERROR',
      {
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  }

  if (!generated?.ok) {
    return failure(
      generated?.status ||
      'VOICE_RESPONSE_TTS_FAILED',
      {
        generated: false,
        ttsResult:
          generated || null
      }
    );
  }

  const audio =
    generated.audio || {};

  if (
    !Buffer.isBuffer(audio.buffer) ||
    !audio.buffer.length
  ) {
    return failure(
      'VOICE_RESPONSE_AUDIO_INVALID',
      {
        generated: true,
        profile:
          generated.profile ||
          null,
        voice:
          generated.voice ||
          null
      }
    );
  }

  let delivery;

  try {
    delivery =
      await sendVoice(
        {
          chatId,
          session:
            input.session,
          audioBuffer:
            audio.buffer,
          mimeType:
            audio.mimeType,
          fileName:
            audio.fileName
        },
        dependencies.wahaOptions || {}
      );
  } catch (error) {
    return failure(
      'VOICE_RESPONSE_WAHA_UNEXPECTED_ERROR',
      {
        generated: true,
        audio: {
          mimeType:
            audio.mimeType,
          format:
            audio.format,
          sizeBytes:
            audio.sizeBytes
        },
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  }

  if (!delivery?.ok) {
    return failure(
      delivery?.status ||
      'VOICE_RESPONSE_DELIVERY_FAILED',
      {
        generated: true,
        audio: {
          mimeType:
            audio.mimeType,
          format:
            audio.format,
          sizeBytes:
            audio.sizeBytes
        },
        delivery:
          delivery || null
      }
    );
  }

  return {
    ok: true,
    status:
      'VOICE_RESPONSE_DELIVERED',
    generated: true,
    sent: true,
    profile:
      generated.profile,
    language:
      generated.language,
    provider:
      generated.provider,
    model:
      generated.model,
    voice:
      generated.voice,
    audio: {
      mimeType:
        audio.mimeType,
      format:
        audio.format,
      sizeBytes:
        audio.sizeBytes,
      fileName:
        audio.fileName
    },
    delivery: {
      provider:
        delivery.provider,
      session:
        delivery.session,
      chatId:
        delivery.chatId,
      messageId:
        delivery.messageId,
      status:
        delivery.status
    }
  };
}
