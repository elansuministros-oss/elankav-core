import { saveLeadFromWahaEvent } from '../lib/whatsapp/lead-service.js';
import { getSessionStatus, getWahaRuntimeConfig, sendFile, sendText } from '../lib/whatsapp/waha-client.js';
import { isValidWahaEvent, normalizeWahaEvent } from '../lib/whatsapp/waha-normalizer.js';
import {
  checkAndRememberWebhookReply,
  getAutoReplySkipReason,
  isAutoReplyEvent,
} from '../lib/whatsapp/webhook-idempotency.js';
import { processSalesConversation } from '../lib/elan-sales-engine/index.js';

function getRoute(req) {
  const url = new URL(req.url || '/api/whatsapp', 'https://elankav-core.local');
  const pathRoute = url.pathname.replace(/^\/api\/whatsapp\/?/, '').replace(/^\/+|\/+$/g, '');
  return pathRoute || url.searchParams.get('action') || 'status';
}

function methodNotAllowed(res) {
  return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
}

function getHeader(req, name) {
  const headers = req.headers || {};
  const expected = String(name || '').toLowerCase();
  const direct = headers[expected] || headers[name];

  if (direct) return direct;

  const match = Object.entries(headers).find(([key]) => String(key).toLowerCase() === expected);
  return match ? match[1] : '';
}

function getIncomingSecret(req) {
  const authorization = String(getHeader(req, 'authorization') || '');
  const url = new URL(req.url || '/api/whatsapp', 'https://elankav-core.local');

  return (
    getHeader(req, 'x-waha-secret') ||
    getHeader(req, 'x-webhook-secret') ||
    url.searchParams.get('secret') ||
    (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')
  );
}

function getExpectedWebhookSessions() {
  const configured = [
    process.env.WAHA_WEBHOOK_SESSION,
    process.env.WAHA_SESSION,
    'ELANKAV',
  ];

  return configured
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getEventSession(event = {}) {
  const payload = event.payload || event.message || event.data || {};
  return String(event.session || payload.session || '').trim();
}

function isStrictSecretRequired() {
  return String(process.env.WAHA_WEBHOOK_REQUIRE_SECRET || '').toLowerCase() === 'true';
}

function isAuthorized(req, event = {}) {
  const expected = process.env.WAHA_WEBHOOK_SECRET;
  const incomingSecret = getIncomingSecret(req);

  if (expected && incomingSecret) {
    return String(incomingSecret) === String(expected);
  }

  if (expected && isStrictSecretRequired()) return false;

  const session = getEventSession(event);
  const expectedSessions = getExpectedWebhookSessions();

  return isValidWahaEvent(event) && Boolean(session) && expectedSessions.includes(session);
}

async function handleStatus(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const result = await getSessionStatus();

    return res.status(result.ok ? 200 : 502).json({
      ...result,
      config: getWahaRuntimeConfig(),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: error.message || 'WAHA no configurado o no disponible',
      config: getWahaRuntimeConfig(),
    });
  }
}

async function handleSendText(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const { chatId, text } = req.body || {};

    if (!chatId || !text) {
      return res.status(400).json({ ok: false, error: 'chatId y text son requeridos' });
    }

    const result = await sendText({ chatId, text });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error enviando texto por WAHA',
    });
  }
}

async function handleSendFile(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const { chatId, fileUrl, caption = '' } = req.body || {};

    if (!chatId || !fileUrl) {
      return res.status(400).json({ ok: false, error: 'chatId y fileUrl son requeridos' });
    }

    const result = await sendFile({ chatId, fileUrl, caption });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error enviando archivo por WAHA',
    });
  }
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const event = req.body || {};

  if (!isAuthorized(req, event)) {
    return res.status(401).json({ ok: false, error: 'Webhook WAHA no autorizado' });
  }

  try {
    if (!isValidWahaEvent(event)) {
      return res.status(400).json({ ok: false, error: 'Evento WAHA invalido' });
    }

    const normalized = normalizeWahaEvent(event);
    const canAutoReply = isAutoReplyEvent(normalized);
    const idempotency = canAutoReply
      ? checkAndRememberWebhookReply(normalized)
      : { duplicate: false, duplicateKey: '', keys: [] };

    const salesResult =
      canAutoReply && !idempotency.duplicate
        ? await processSalesConversation({ normalized })
        : {
            ok: true,
            shouldReply: false,
            responseText: '',
            analysis: {
              reason: idempotency.duplicate ? 'mensaje_ya_procesado' : getAutoReplySkipReason(normalized),
            },
          };

    const leadResult = await saveLeadFromWahaEvent(normalized, salesResult);

    let replyResult = {
      ok: true,
      skipped: true,
      reason: idempotency.duplicate
        ? 'Mensaje ya procesado; no se reenvia respuesta'
        : salesResult.shouldReply
          ? 'Respuesta vacia'
          : 'Evento no requiere respuesta',
    };

    if (canAutoReply && !idempotency.duplicate && salesResult.shouldReply && salesResult.responseText) {
      try {
        replyResult = await sendText({
          chatId: normalized.chatId,
          text: salesResult.responseText,
        });
      } catch (error) {
        replyResult = {
          ok: false,
          error: error.message || 'No se pudo enviar respuesta WAHA',
        };
      }
    }

    return res.status(200).json({
      ok: true,
      received: true,
      normalized,
      salesEngine: {
        ok: salesResult.ok,
        shouldReply: salesResult.shouldReply,
        responseText: salesResult.responseText,
        analysis: salesResult.analysis,
      },
      idempotency: {
        duplicate: Boolean(idempotency.duplicate),
        duplicateKey: idempotency.duplicateKey || null,
        keys: idempotency.keys || [],
      },
      lead: {
        ok: leadResult.ok,
        updated: Boolean(leadResult.updated),
        skipped: Boolean(leadResult.skipped),
        error: leadResult.error || null,
      },
      reply: {
        ok: replyResult.ok,
        skipped: Boolean(replyResult.skipped),
        error: replyResult.error || null,
      },
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      received: true,
      error: error.message || 'Error procesando webhook WAHA',
    });
  }
}

export default async function handler(req, res) {
  const route = getRoute(req);

  if (route === 'status') return handleStatus(req, res);
  if (route === 'send-text') return handleSendText(req, res);
  if (route === 'send-file') return handleSendFile(req, res);
  if (route === 'webhook') return handleWebhook(req, res);

  return res.status(404).json({
    ok: false,
    error: 'Ruta WhatsApp no encontrada',
    route,
  });
}
