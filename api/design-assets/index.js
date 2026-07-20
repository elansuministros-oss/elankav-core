import { findDesignRequestByAccess } from '../../adapters/designPortalSupabaseAdapter.js';
import { hashAccessToken } from '../../services/designPortalService.js';
import { createPublicAssetId, createPublicAssetUrl, normalizeAssetDescriptor } from '../../services/designAssetPublicService.js';

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizeText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://visual.elankav.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'Metodo no permitido.' });
  }

  try {
    const requestCode = normalizeText(req.body?.requestCode, 80).toUpperCase();
    const accessToken = normalizeText(req.body?.accessToken, 300);
    const revisionNumber = Number(req.body?.revisionNumber || 0);

    if (!/^DESIGN-[A-Z0-9]+-[A-Z0-9]{4}$/.test(requestCode) || !accessToken) {
      return send(res, 400, { ok: false, error: 'Acceso de diseno invalido.' });
    }

    const stored = await findDesignRequestByAccess({
      requestCode,
      accessTokenHash: hashAccessToken(accessToken)
    });

    if (!stored) return send(res, 404, { ok: false, error: 'Diseno no encontrado.' });
    if (!['review', 'approved', 'quoted', 'closed'].includes(stored.status)) {
      return send(res, 409, { ok: false, error: 'El diseno todavia no esta listo para publicarse.' });
    }

    const currentResults = Array.isArray(stored.result_files) ? stored.result_files : [];
    const history = Array.isArray(stored.version_history) ? stored.version_history : [];
    let selected = null;

    if (revisionNumber > 0 && revisionNumber !== Number(stored.revision_number || 1)) {
      const version = history.find(entry => Number(entry?.revisionNumber || 0) === revisionNumber);
      selected = Array.isArray(version?.resultFiles) ? version.resultFiles[0] : null;
    } else {
      selected = currentResults[0] || null;
    }

    if (!selected?.bucket || !selected?.path) {
      return send(res, 404, { ok: false, error: 'El diseno no tiene una imagen publicable.' });
    }

    const asset = normalizeAssetDescriptor(selected);
    const assetId = createPublicAssetId(asset);
    const publicUrl = createPublicAssetUrl(asset);

    return send(res, 200, {
      ok: true,
      result: {
        assetId,
        publicUrl,
        requestCode: stored.request_code,
        revisionNumber: revisionNumber > 0 ? revisionNumber : Number(stored.revision_number || 1),
        mimeType: asset.mimeType,
        name: asset.name
      }
    });
  } catch (error) {
    const configuration = [
      'DESIGN_ASSET_SECRET_NOT_CONFIGURED',
      'DESIGN_SUPABASE_NOT_CONFIGURED'
    ].includes(error?.code);
    const invalid = String(error?.code || '').startsWith('DESIGN_ASSET_');
    if (!invalid && !configuration) {
      console.error('[DESIGN_ASSET_PUBLISH_ERROR]', error?.code || error?.message || 'UNKNOWN');
    }
    return send(res, configuration ? 503 : invalid ? 400 : 503, {
      ok: false,
      error: configuration
        ? 'Publicacion de imagenes no configurada.'
        : invalid
          ? 'La imagen no puede publicarse.'
          : 'No fue posible publicar la imagen.'
    });
  }
}
