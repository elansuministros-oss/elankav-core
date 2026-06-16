export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const { usuario = '', clave = '' } = req.body || {};

  if (
    usuario !== process.env.KAVTORE_ADMIN_USER ||
    clave !== process.env.KAVTORE_ADMIN_PASS
  ) {
    return res.status(401).json({ ok: false, error: 'Acceso denegado.' });
  }

  return res.status(200).json({
    ok: true,
    token: process.env.KAVTORE_SESSION_TOKEN
  });
}
