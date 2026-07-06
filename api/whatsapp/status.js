import { getSessionStatus, getWahaRuntimeConfig } from '../../lib/whatsapp/waha-client.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

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
