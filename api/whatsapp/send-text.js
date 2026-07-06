import { sendText } from '../../lib/whatsapp/waha-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

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
