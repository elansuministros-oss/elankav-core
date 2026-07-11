const DEFAULT_ORCHESTRATOR_URL =
  'https://orchestrator.elankav.com/api/messages';

const DEFAULT_WAHA_URL =
  'https://waha.elankav.com';

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

function extractText(payload = {}) {
  return String(
    payload.body ||
    payload.text ||
    payload.caption ||
    payload.message?.conversation ||
    payload.message?.extendedTextMessage?.text ||
    payload.message?.imageMessage?.caption ||
    payload.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function extractIncoming(body = {}) {
  const payload =
    body.payload && typeof body.payload === 'object'
      ? body.payload
      : body;

  const chatId =
    payload.from ||
    payload.chatId ||
    payload.to ||
    payload.key?.remoteJid ||
    '';

  const fromMe = Boolean(
    payload.fromMe ??
    payload.key?.fromMe ??
    false
  );

  const event = String(
    body.event ||
    payload.event ||
    ''
  ).toLowerCase();

  return {
    event,
    session:
      body.session ||
      payload.session ||
      process.env.WAHA_SESSION ||
      'ELANKAV',
    chatId,
    phone: normalizePhone(chatId),
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
  rawEvent
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
        event: rawEvent || null
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
        reason: 'MESSAGE_INCOMPLETE'
      });
    }

    const orchestrator =
      await callOrchestrator({
        message: incoming.text,
        phone: incoming.phone,
        session: incoming.session,
        rawEvent: incoming.event
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
