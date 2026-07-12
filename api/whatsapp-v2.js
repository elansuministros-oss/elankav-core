import { resolveWhatsAppIdentity } from '../services/whatsappIdentityService.js';
import { extractAudioCandidate } from '../adapters/audioIntakeAdapter.js';
import { validateAudioIntake } from '../services/audioIntakeService.js';

const DEFAULT_ORCHESTRATOR_URL =
  'https://orchestrator.elankav.com/api/messages';
const DEFAULT_WAHA_URL = 'https://waha.elankav.com';

function json(res, status, payload) {
  res.status(status).json(payload);
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
      const audioIntake = validateAudioIntake(audioCandidate);

      return json(res, 200, {
        ok: audioIntake.accepted,
        processed: false,
        mediaDetected: true,
        status: audioIntake.status,
        reason: audioIntake.reason,
        audio: audioIntake.audio || null
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
