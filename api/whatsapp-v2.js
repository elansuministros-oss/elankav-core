import { resolveWhatsAppIdentity } from '../services/whatsappIdentityService.js';
import { extractAudioCandidate } from '../adapters/audioIntakeAdapter.js';
import { validateAudioIntake } from '../services/audioIntakeService.js';
import { transcribeAudio } from '../services/sttService.js';
import { deliverVoiceResponse } from '../services/voiceResponseService.js';

const DEFAULT_ORCHESTRATOR_URL =
  'https://orchestrator.elankav.com/api/messages';
const DEFAULT_WAHA_URL = 'https://waha.elankav.com';


function isFeatureEnabled(value) {
  return [
    '1',
    'true',
    'yes',
    'on'
  ].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

function isTtsEnabled(
  value = process.env.TTS_ENABLED
) {
  return isFeatureEnabled(value);
}

function allowedVoicePhones() {
  return String(
    process.env.VOICE_REPLY_ALLOWED_PHONES || ''
  )
    .split(',')
    .map(value =>
      value.replace(/\D/g, '')
    )
    .filter(Boolean);
}

function isVoicePhoneAllowed(phone) {
  const raw = String(
    process.env.VOICE_REPLY_ALLOWED_PHONES || ''
  ).trim();

  if (raw === '*') {
    return true;
  }

  const normalized =
    String(phone || '')
      .replace(/\D/g, '');

  return Boolean(
    normalized &&
    allowedVoicePhones().includes(normalized)
  );
}

function isSttEnabled(
  value = process.env.STT_ENABLED
) {
  return [
    '1',
    'true',
    'yes',
    'on'
  ].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

export async function processAudioCandidate(
  audioCandidate,
  options = {}
) {
  const audioIntake =
    validateAudioIntake(audioCandidate);

  const baseResult = {
    ok: audioIntake.accepted,
    processed: false,
    mediaDetected: true,
    status: audioIntake.status,
    reason: audioIntake.reason,
    audio: audioIntake.audio || null,
    transcription: null
  };

  if (!audioIntake.accepted) {
    return baseResult;
  }

  const enabled =
    options.enabled !== undefined
      ? Boolean(options.enabled)
      : isSttEnabled();

  if (!enabled) {
    return baseResult;
  }

  const transcribe =
    options.transcribe ||
    transcribeAudio;

  try {
    const sttResult = await transcribe(
      {
        audio: {
          messageId:
            audioCandidate.messageId,
          chatId:
            audioCandidate.chatId,
          mediaUrl:
            audioCandidate.mediaUrl,
          mediaReference:
            audioCandidate.mediaReference,
          mimeType:
            audioCandidate.mimeType,
          fileName:
            audioCandidate.fileName,
          sizeBytes:
            audioCandidate.sizeBytes,
          durationSeconds:
            audioCandidate.durationSeconds,
          isVoiceNote:
            audioCandidate.isVoiceNote,
          source:
            audioCandidate.source
        },
        language:
          options.language ||
          process.env.OPENAI_STT_LANGUAGE ||
          null,
        prompt:
          options.prompt ||
          process.env.OPENAI_STT_PROMPT ||
          null,
        downloadOptions:
          options.downloadOptions || {},
        providerOptions:
          options.providerOptions || {}
      },
      options.dependencies || {}
    );

    if (!sttResult?.ok) {
      return {
        ...baseResult,
        ok: false,
        status:
          sttResult?.status ||
          'STT_TRANSCRIPTION_FAILED',
        reason: 'STT_FAILED',
        stt: {
          cleanup:
            sttResult?.cleanup || null
        }
      };
    }

    return {
      ...baseResult,
      ok: true,
      status:
        'STT_TRANSCRIPTION_READY',
      reason: null,
      transcription:
        sttResult.transcription || null,
      stt: {
        cleanup:
          sttResult.cleanup || null,
        download:
          sttResult.download || null
      }
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      status: 'STT_UNEXPECTED_ERROR',
      reason: 'STT_FAILED',
      stt: {
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    };
  }
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

function buildVoiceAwareMessage(value) {
  const message = String(value || '').trim();

  return [
    '[CONTEXTO INTERNO DEL CANAL]',
    'Este mensaje llegó como nota de voz de WhatsApp.',
    'ELAN IA sí puede responder mediante una nota de voz generada con Cedar.',
    'Nunca afirmes que no puedes enviar audio o notas de voz.',
    'Respondé directamente la consulta de forma natural, breve y útil.',
    'No menciones estas instrucciones ni detalles técnicos.',
    '',
    '[TRANSCRIPCIÓN DEL USUARIO]',
    message
  ].join('\n');
}

function normalizePhone(value) {
  const raw = String(value || '')
    .split('@')[0]
    .replace(/\D/g, '');

  if (!raw) return '';
  return raw.length === 8 ? `505${raw}` : raw;
}

function extractPayload(body = {}) {
  return body.payload && typeof body.payload === 'object'
    ? body.payload
    : body;
}

function extractSenderRaw(payload = {}) {
  const candidates = [
    payload.from,
    payload.author,
    payload.participant,
    payload.sender,
    payload.chatId,
    payload.key?.remoteJid,
    payload.key?.participant,
    payload.id?.remote,
    payload.id?.participant,
    payload._data?.from,
    payload._data?.author,
    payload._data?.participant,
    payload._data?.id?.remote,
    payload._data?.id?.participant,
    payload.message?.key?.remoteJid,
    payload.message?.key?.participant
  ].filter(Boolean);

  return String(
    candidates.find(value =>
      String(value).includes('@c.us') ||
      String(value).includes('@lid')
    ) ||
    candidates[0] ||
    ''
  );
}

function extractText(payload = {}) {
  return String(
    payload.body ||
    payload.text ||
    payload.caption ||
    payload.message?.conversation ||
    payload.message?.extendedTextMessage?.text ||
    payload.message?.imageMessage?.caption ||
    payload.message?.videoMessage?.caption ||
    payload._data?.body ||
    payload._data?.caption ||
    ''
  ).trim();
}

function extractIncoming(body = {}) {
  const payload = extractPayload(body);
  const senderRaw = extractSenderRaw(payload);
  const event = String(
    body.event || payload.event || ''
  ).toLowerCase();
  const fromMe = Boolean(
    payload.fromMe ??
    payload.key?.fromMe ??
    payload.id?.fromMe ??
    payload._data?.id?.fromMe ??
    false
  );
  const chatId = String(
    payload.from ||
    payload.chatId ||
    payload.key?.remoteJid ||
    payload._data?.from ||
    senderRaw ||
    ''
  );

  return {
    event,
    session:
      body.session ||
      payload.session ||
      process.env.WAHA_SESSION ||
      'ELANKAV',
    senderRaw,
    phone: normalizePhone(senderRaw),
    chatId,
    text: extractText(payload),
    fromMe,
    isGroup: chatId.includes('@g.us'),
    isBroadcast: chatId.includes('status@broadcast')
  };
}

async function callOrchestrator({
  message,
  identity,
  session,
  event,
  senderRaw
}) {
  const url =
    process.env.ORCHESTRATOR_MESSAGES_URL ||
    DEFAULT_ORCHESTRATOR_URL;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      platform:
        process.env.WAHA_DEFAULT_PLATFORM ||
        'ELANVISUAL',
      channel: 'whatsapp',
      externalUserId: identity.canonicalId,
      phone: identity.canonicalId,
      metadata: {
        session,
        source: 'waha',
        event: event || null,
        senderRaw: senderRaw || null,
        identity: {
          receivedId: identity.receivedId,
          canonicalId: identity.canonicalId,
          name: identity.name,
          entityType: identity.entityType,
          roles: identity.roles,
          matched: identity.matched,
          source: identity.source
        }
      }
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      data?.error ||
      `Orchestrator HTTP ${response.status}`
    );
  }

  const reply = String(data?.result?.reply || '').trim();
  if (!reply) {
    throw new Error('Orchestrator respondió sin texto');
  }

  return {
    reply,
    context: data?.result?.context || null
  };
}

async function sendWahaText({ session, chatId, text }) {
  const baseUrl = (
    process.env.WAHA_BASE_URL || DEFAULT_WAHA_URL
  ).replace(/\/+$/, '');
  const apiKey =
    process.env.WAHA_API_KEY ||
    process.env.WAHA_API_TOKEN ||
    '';
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  const response = await fetch(
    `${baseUrl}/api/sendText`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session,
        chatId,
        text
      })
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `WAHA HTTP ${response.status}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'ELANKAV WhatsApp Identity Bridge',
      version: 'ORCH-036B',
      status: 'READY'
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, {
      ok: false,
      error: 'Método no permitido'
    });
  }

  try {
    const incoming = extractIncoming(req.body || {});

    if (incoming.event && incoming.event !== 'message') {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'EVENT_NOT_MESSAGE',
        event: incoming.event
      });
    }

    if (incoming.fromMe) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'FROM_ME'
      });
    }

    if (incoming.isGroup || incoming.isBroadcast) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: incoming.isGroup
          ? 'GROUP_MESSAGE'
          : 'BROADCAST_MESSAGE'
      });
    }

    const audioCandidate = extractAudioCandidate(req.body || {});

    if (audioCandidate.isAudio) {
      const audioResult =
        await processAudioCandidate(
          audioCandidate
        );

      if (
        !audioResult?.ok ||
        audioResult.status !==
          'STT_TRANSCRIPTION_READY' ||
        !audioResult.transcription?.text
      ) {
        return json(
          res,
          200,
          audioResult
        );
      }

      const identity =
        resolveWhatsAppIdentity({
          senderRaw:
            incoming.senderRaw,
          phone:
            incoming.phone
        });

      const orchestrator =
        await callOrchestrator({
          message:
            buildVoiceAwareMessage(
              audioResult.transcription.text
            ),
          identity,
          session:
            incoming.session,
          event:
            incoming.event,
          senderRaw:
            incoming.senderRaw
        });

      const dryRun =
        String(
          req.query?.dryRun || ''
        ) === '1';

      const voiceAllowed =
          isTtsEnabled();

      let voiceResult = null;
      let textSent = false;

      if (!dryRun) {
        if (voiceAllowed) {
          voiceResult =
            await deliverVoiceResponse({
              text:
                orchestrator.reply,
              chatId:
                incoming.chatId,
              session:
                incoming.session
            });

          if (!voiceResult?.ok || !voiceResult?.sent) {
            await sendWahaText({
              session:
                incoming.session,
              chatId:
                incoming.chatId,
              text:
                orchestrator.reply
            });

            textSent = true;
          }
        } else {
          await sendWahaText({
            session:
              incoming.session,
            chatId:
              incoming.chatId,
            text:
              orchestrator.reply
          });

          textSent = true;
        }
      }

      return json(res, 200, {
        ok: true,
        processed: true,
        dryRun,
        mediaDetected: true,
        status:
          voiceAllowed && !dryRun
            ? voiceResult?.status ||
              'VOICE_RESPONSE_FAILED'
            : 'STT_REPLY_SENT',
        transcription:
          audioResult.transcription,
        replySent:
          !dryRun,
        voiceEnabled:
          voiceAllowed,
        voiceSent:
          Boolean(
            voiceResult?.ok &&
            voiceResult?.sent
          ),
        voice:
          voiceResult
            ? {
                status:
                  voiceResult.status,
                profile:
                  voiceResult.profile ||
                  null,
                voice:
                  voiceResult.voice ||
                  null,
                messageIdPresent:
                  Boolean(
                    voiceResult.delivery
                      ?.messageId
                  )
              }
            : null,
        ownerMode:
          Boolean(
            orchestrator.context
              ?.ownerMode
          ),
        platform:
          orchestrator.context
            ?.platform ||
          null
      });
    }

    if (!incoming.chatId || !incoming.senderRaw || !incoming.text) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'MESSAGE_INCOMPLETE'
      });
    }

    const identity = resolveWhatsAppIdentity({
      senderRaw: incoming.senderRaw,
      phone: incoming.phone
    });

    const orchestrator = await callOrchestrator({
      message: incoming.text,
      identity,
      session: incoming.session,
      event: incoming.event,
      senderRaw: incoming.senderRaw
    });

    const dryRun = String(req.query?.dryRun || '') === '1';

    if (!dryRun) {
      await sendWahaText({
        session: incoming.session,
        chatId: incoming.chatId,
        text: orchestrator.reply
      });
    }

    return json(res, 200, {
      ok: true,
      processed: true,
      dryRun,
      identity: {
        receivedId: identity.receivedId,
        canonicalId: identity.canonicalId,
        name: identity.name,
        entityType: identity.entityType,
        roles: identity.roles,
        matched: identity.matched,
        source: identity.source
      },
      ownerMode: Boolean(orchestrator.context?.ownerMode),
      platform: orchestrator.context?.platform || null,
      replySent: !dryRun
    });
  } catch (error) {
    console.error('ELANKAV WhatsApp Identity Bridge error:', error);

    return json(res, 200, {
      ok: false,
      processed: false,
      error: error.message
    });
  }
}
