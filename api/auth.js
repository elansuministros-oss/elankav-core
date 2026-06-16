export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const usuario = String(req.body?.usuario || '').trim();
  const clave = String(req.body?.clave || '').trim();

  const adminUser = String(process.env.KAVTORE_ADMIN_USER || '').trim();
  const adminPass = String(process.env.KAVTORE_ADMIN_PASS || '').trim();
  const token = String(process.env.KAVTORE_SESSION_TOKEN || '').trim();

  if (!adminUser || !adminPass || !token) {
    return res.status(500).json({
      ok: false,
      error: 'Variables de login no configuradas en Vercel.'
    });
  }

  if (usuario !== adminUser || clave !== adminPass) {
    return res.status(401).json({
      ok: false,
      error: 'Acceso denegado. Revisá mayúsculas, espacios o contraseña actual en Vercel.'
    });
  }

  return res.status(200).json({
    ok: true,
    token
  });
}
