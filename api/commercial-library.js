import {
  getCommercialOffer
} from '../services/commercialLibraryService.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function firstQueryValue(value) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, {
      success: false,
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const productId = String(
      firstQueryValue(req.query?.productId) || ''
    ).trim();
    const sizeCm = firstQueryValue(req.query?.sizeCm);

    if (!productId) {
      return json(res, 400, {
        success: false,
        error: 'PRODUCT_ID_REQUIRED'
      });
    }

    const result = getCommercialOffer({
      productId,
      sizeCm
    });

    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, {
      success: true,
      result
    });
  } catch (error) {
    const unknownProduct = String(error?.message || '')
      .startsWith('Producto comercial no registrado:');

    return json(res, unknownProduct ? 404 : 400, {
      success: false,
      error: unknownProduct
        ? 'PRODUCT_NOT_FOUND'
        : 'INVALID_COMMERCIAL_QUERY'
    });
  }
}
