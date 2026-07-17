import { downloadDesignAsset } from '../../adapters/designPortalSupabaseAdapter.js';
import { resolvePublicAssetId } from '../../services/designAssetPublicService.js';

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function assetIdFromRequest(req = {}) {
  const queryValue = Array.isArray(req.query?.assetId) ? req.query.assetId[0] : req.query?.assetId;
  if (queryValue) return String(queryValue);
  const match = String(req.url || '').match(/\/api\/design-assets\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { ok: false, error: 'Metodo no permitido.' });
  }

  try {
    const asset = resolvePublicAssetId(assetIdFromRequest(req));
    const file = await downloadDesignAsset({ bucket: asset.bucket, path: asset.path });

    res.setHeader('Content-Type', asset.mimeType || file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${asset.name.replace(/["\r\n]/g, '')}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(file.bytes);
  } catch (error) {
    const invalid = String(error?.code || '').startsWith('DESIGN_ASSET_');
    if (!invalid) console.error('[DESIGN_ASSET_PUBLIC_ERROR]', error?.code || error?.message || 'UNKNOWN');
    return sendJson(res, invalid ? 404 : 503, {
      ok: false,
      error: invalid ? 'Imagen no encontrada.' : 'La imagen no esta disponible temporalmente.'
    });
  }
}
