import { saveLeadFromWahaEvent } from '../lib/whatsapp/lead-service.js';
import { getSessionStatus, getWahaRuntimeConfig, sendFile, sendText } from '../lib/whatsapp/waha-client.js';
import { isValidWahaEvent, normalizeWahaEvent } from '../lib/whatsapp/waha-normalizer.js';
import { processSalesConversation } from '../lib/elan-sales-engine/index.js';

function getRoute(req) {
  const url = new URL(req.url || '/api/whatsapp', 'https://elankav-core.local');
  const pathRoute = url.pathname.replace(/^\/api\/whatsapp\/?/, '').replace(/^\/+|\/+$/g, '');
  return pathRoute || url.searchParams.get('action') || 'status';
}

function methodNotAllowed(res) {
  return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
}

function getIncomingSecret(req) {
  const authorization = String(req.headers.authorization || '');
  const url = new URL(req.url || '/api/whatsapp', 'https://elankav-core.local');

  return (
    req.headers['x-waha-secret'] ||
    req.headers['x-webhook-secret'] ||
    url.searchParams.get('secret') ||
    (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')
  );
}

function isAuthorized(req) {
  const expected = process.env.WAHA_WEBHOOK_SECRET;
  if (!expected) return true;

  return String(getIncomingSecret(req) || '') === String(expected);
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

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Webhook WAHA no autorizado' });
  }

  try {
    const event = req.body || {};

    if (!isValidWahaEvent(event)) {
      return res.status(400).json({ ok: false, error: 'Evento WAHA invalido' });
    }

    const normalized = normalizeWahaEvent(event);
    const salesResult = await processSalesConversation({ normalized });
    const leadResult = await saveLeadFromWahaEvent(normalized, salesResult);

    let replyResult = {
      ok: true,
      skipped: true,
      reason: salesResult.shouldReply ? 'Respuesta vacia' : 'Evento no requiere respuesta',
    };

    if (salesResult.shouldReply && salesResult.responseText) {
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
