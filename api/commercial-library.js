import {
  loadCommercialOffer
} from '../services/commercialCatalogService.js';

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function createCommercialLibraryHandler({
  loadOffer = loadCommercialOffer
} = {}) {
  return async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const productId = String(
      firstQueryValue(req.query?.productId) || ''
    ).trim();
    const message = String(
      firstQueryValue(req.query?.message) || ''
    ).trim();
    const sizeCm = firstQueryValue(req.query?.sizeCm);

    if (!productId && !message) {
      return res.status(400).json({
        success: false,
        error: 'COMMERCIAL_QUERY_REQUIRED'
      });
    }

    const result = await loadOffer({
      productId: productId || undefined,
      message: message || undefined,
      sizeCm
    });

    res.setHeader('Cache-Control', 'no-store');

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'PRODUCT_NOT_FOUND'
      });
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    const unknownProduct = String(error?.message || '')
      .startsWith('Producto comercial no registrado:');
    const unavailable = String(error?.code || '')
      .startsWith('COMMERCIAL_SUPABASE_');

    return res.status(unavailable ? 503 : unknownProduct ? 404 : 400).json({
      success: false,
      error: unavailable
        ? 'COMMERCIAL_LIBRARY_UNAVAILABLE'
        : unknownProduct
        ? 'PRODUCT_NOT_FOUND'
        : 'INVALID_COMMERCIAL_QUERY'
    });
  }
  };
}

const handler = createCommercialLibraryHandler();

export { createCommercialLibraryHandler };
export default handler;
