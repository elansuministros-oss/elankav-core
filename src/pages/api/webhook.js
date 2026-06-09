const VERIFY_TOKEN = 'ELANKAV_VERIFY_2026';

export default function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Token de verificación inválido');
  }

  if (req.method === 'POST') {
    console.log('Webhook WhatsApp recibido:', JSON.stringify(req.body, null, 2));

    return res.status(200).json({
      ok: true,
      recibido: true,
      sistema: 'ELAN AI',
      destino: 'CRM CENTRAL',
    });
  }

  return res.status(405).json({
    ok: false,
    error: 'Método no permitido',
  });
}