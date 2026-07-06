import { saveLeadFromWahaEvent } from '../../lib/whatsapp/lead-service.js';
import { isValidWahaEvent, normalizeWahaEvent } from '../../lib/whatsapp/waha-normalizer.js';

function getIncomingSecret(req) {
  const authorization = String(req.headers.authorization || '');

  return (
    req.headers['x-waha-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.query?.secret ||
    (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')
  );
}

function isAuthorized(req) {
  const expected = process.env.WAHA_WEBHOOK_SECRET;
  if (!expected) return true;

  return String(getIncomingSecret(req) || '') === String(expected);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Webhook WAHA no autorizado' });
  }

  try {
    const event = req.body || {};

    if (!isValidWahaEvent(event)) {
      return res.status(400).json({ ok: false, error: 'Evento WAHA invalido' });
    }

    const normalized = normalizeWahaEvent(event);
    const leadResult = await saveLeadFromWahaEvent(normalized);

    return res.status(200).json({
      ok: true,
      received: true,
      normalized,
      lead: {
        ok: leadResult.ok,
        skipped: Boolean(leadResult.skipped),
        error: leadResult.error || null,
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
