export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const usuario = String(req.body?.usuario || '').trim().toLowerCase();
  const clave = String(req.body?.clave || '').trim();

  const configuredUsers = [
    process.env.KAVTORE_ADMIN_USER,
    process.env.KAVTORE_ADMIN_EMAIL,
    'elansuministros@gmail.com'
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  const adminPass = String(
    process.env.KAVTORE_ADMIN_PASS || process.env.KAVTORE_ADMIN_PASSWORD || ''
  ).trim();
  const token = String(process.env.KAVTORE_SESSION_TOKEN || '').trim();

  if (configuredUsers.length === 0 || !adminPass || !token) {
    return res.status(500).json({
      ok: false,
      error: 'Variables de login no configuradas en Vercel.'
    });
  }

  const usuarioValido = configuredUsers.includes(usuario);
  const claveValida = clave === adminPass;

  if (!usuarioValido || !claveValida) {
    return res.status(401).json({
      ok: false,
      error: 'Acceso denegado. Verificá la contraseña configurada en Vercel.'
    });
  }

  return res.status(200).json({
    ok: true,
    token
  });
}
