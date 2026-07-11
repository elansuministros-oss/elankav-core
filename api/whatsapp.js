const DEFAULT_ORCHESTRATOR_URL =
  'https://orchestrator.elankav.com/api/messages';

const DEFAULT_WAHA_URL =
  'https://waha.elankav.com';

const OWNER_PHONE = '50588388940';
const SESSION_PHONE = '50578828089';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function normalizePhone(value) {
  const raw = String(value || '')
    .split('@')[0]
    .replace(/\D/g, '');

  if (!raw) {
    return '';
  }

  if (raw.length === 8) {
    return `505${raw}`;
  }

  return raw;
}

function collectIdentityCandidates(
  value,
  output = [],
  depth = 0
) {
  if (depth > 6 || value == null) {
    return output;
  }

  if (typeof value === 'string') {
    if (
      value.includes('@c.us') ||
      value.includes('@lid') ||
      /^\+?\d[\d\s()-]{7,}$/.test(value)
    ) {
      output.push(value);
    }

    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectIdentityCandidates(
        item,
        output,
        depth + 1
      );
    }

    return output;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectIdentityCandidates(
        item,
        output,
        depth + 1
      );
    }
  }

  return output;
}

function resolveSender(payload = {}) {
  const explicitCandidates = [
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

  const discoveredCandidates =
    collectIdentityCandidates(payload);

  const allCandidates = [
    ...explicitCandidates,
    ...discoveredCandidates
  ];

  const normalized = allCandidates
    .map(value => ({
      raw: String(value),
      phone: normalizePhone(value),
      isCus: String(value).includes('@c.us'),
      isLid: String(value).includes('@lid')
    }))
    .filter(item => item.phone);

  // El número propietario tiene prioridad absoluta si aparece
  // en cualquier campo del payload real de WAHA.
  const owner = normalized.find(
    item => item.phone === OWNER_PHONE
  );

  if (owner) {
    return owner;
  }

  const preferred = normalized.find(
    item =>
      item.phone !== SESSION_PHONE &&
      item.isCus
  );

  if (preferred) {
    return preferred;
  }

  const nonSession = normalized.find(
    item =>
      item.phone !== SESSION_PHONE &&
      !item.isLid
  );

  if (nonSession) {
    return nonSession;
  }

  return normalized[0] || {
    raw: '',
    phone: '',
    isCus: false,
    isLid: false
  };
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
  const payload =
    body.payload && typeof body.payload === 'object'
      ? body.payload
      : body;

  const sender = resolveSender(payload);

  const fromMe = Boolean(
    payload.fromMe ??
    payload.key?.fromMe ??
    payload.id?.fromMe ??
    payload._data?.id?.fromMe ??
    false
  );

  const event = String(
    body.event ||
    payload.event ||
    ''
  ).toLowerCase();

  const chatId =
    sender.raw ||
    payload.from ||
    payload.chatId ||
    payload.key?.remoteJid ||
    payload._data?.from ||
    '';

  return {
    event,
    session:
      body.session ||
      payload.session ||
      process.env.WAHA_SESSION ||
      'ELANKAV',
    chatId,
    phone: sender.phone,
    senderRaw: sender.raw,
    text: extractText(payload),
    fromMe,
    isGroup: String(chatId).includes('@g.us'),
    isBroadcast:
      String(chatId).includes('status@broadcast')
  };
}

async function callOrchestrator({
  message,
  phone,
  session,
  rawEvent,
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
      externalUserId: phone,
      metadata: {
        session,
        source: 'waha',
        event: rawEvent || null,
        senderRaw: senderRaw || null
      }
    })
  });

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.error ||
      `HTTP ${response.status}`;

    throw new Error(
      `Orchestrator rechazó el mensaje: ${detail}`
    );
  }

  const reply = String(
    data?.result?.reply || ''
  ).trim();

  if (!reply) {
    throw new Error(
      'Orchestrator respondió sin texto'
    );
  }

  return {
    reply,
    context: data?.result?.context || null
  };
}

async function sendWahaText({
  session,
  chatId,
  text
}) {
  const baseUrl = (
    process.env.WAHA_BASE_URL ||
    DEFAULT_WAHA_URL
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

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const detail =
      data?.message ||
      data?.error ||
      `HTTP ${response.status}`;

    throw new Error(
      `WAHA rechazó sendText: ${detail}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'ELANKAV WhatsApp Bridge',
      version: 'ORCH-033C',
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
    const incoming =
      extractIncoming(req.body || {});

    if (
      incoming.event &&
      incoming.event !== 'message'
    ) {
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

    if (incoming.isGroup) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'GROUP_MESSAGE'
      });
    }

    if (incoming.isBroadcast) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'BROADCAST_MESSAGE'
      });
    }

    if (
      !incoming.chatId ||
      !incoming.phone ||
      !incoming.text
    ) {
      return json(res, 200, {
        ok: true,
        ignored: true,
        reason: 'MESSAGE_INCOMPLETE',
        debug: {
          senderRaw: incoming.senderRaw || null,
          phone: incoming.phone || null,
          hasText: Boolean(incoming.text)
        }
      });
    }

    const orchestrator =
      await callOrchestrator({
        message: incoming.text,
        phone: incoming.phone,
        session: incoming.session,
        rawEvent: incoming.event,
        senderRaw: incoming.senderRaw
      });

    const dryRun =
      String(req.query?.dryRun || '') === '1';

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
      phone: incoming.phone,
      senderRaw: incoming.senderRaw,
      ownerMode:
        Boolean(orchestrator.context?.ownerMode),
      platform:
        orchestrator.context?.platform || null,
      replySent: !dryRun
    });
  } catch (error) {
    console.error(
      'ELANKAV WhatsApp Bridge error:',
      error
    );

    return json(res, 200, {
      ok: false,
      processed: false,
      error: error.message
    });
  }
}
