import {
  listCommercialProducts
} from '../adapters/commercialSupabaseAdapter.js';

function normalizeCommercialText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapCommercialProduct(row) {
  return Object.freeze({
    status: 'active',
    source: 'Supabase Commercial Products',
    productId: row.product_id,
    platformId: row.platform_id,
    productVersion: row.version,
    productName: row.name,
    description: row.description,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    specifications: row.specifications || {},
    priceOffers: Array.isArray(row.price_offers)
      ? row.price_offers
      : [],
    salesGuidance: row.sales_guidance || {},
    commercialRules: row.commercial_rules || {}
  });
}

async function loadCommercialOffer(
  { productId, message } = {},
  { listProducts = listCommercialProducts } = {}
) {
  const rows = await listProducts();
  const normalizedProductId = String(productId || '').trim();
  const normalizedMessage = normalizeCommercialText(message);
  const row = normalizedProductId
    ? rows.find(item => item.product_id === normalizedProductId)
    : rows.find(item =>
        (Array.isArray(item.aliases) ? item.aliases : []).some(alias =>
          normalizedMessage.includes(normalizeCommercialText(alias))
        )
      );

  return row ? mapCommercialProduct(row) : null;
}

export {
  loadCommercialOffer,
  mapCommercialProduct,
  normalizeCommercialText
};
