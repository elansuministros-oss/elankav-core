import { sendFile } from '../../lib/whatsapp/waha-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

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
