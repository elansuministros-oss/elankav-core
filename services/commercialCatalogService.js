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

function commercialAliasScore(normalizedMessage, alias) {
  const normalizedAlias = normalizeCommercialText(alias);
  if (!normalizedAlias) return 0;
  if (normalizedMessage.includes(normalizedAlias)) {
    return 1000 + normalizedAlias.length;
  }

  const tokens = normalizedAlias.split(' ').filter(Boolean);
  if (tokens.length < 2) return 0;
  const messageTokens = new Set(normalizedMessage.split(' ').filter(Boolean));
  return tokens.every(token => messageTokens.has(token))
    ? 100 + (tokens.length * 10) + normalizedAlias.length
    : 0;
}

function commercialProductScore(row, normalizedMessage) {
  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
  return Math.max(
    commercialAliasScore(normalizedMessage, row.name),
    ...aliases.map(alias => commercialAliasScore(normalizedMessage, alias))
  );
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
    : rows
        .map(item => ({
          item,
          score: commercialProductScore(item, normalizedMessage)
        }))
        .filter(candidate => candidate.score > 0)
        .sort((left, right) => right.score - left.score)[0]?.item;

  return row ? mapCommercialProduct(row) : null;
}

export {
  commercialAliasScore,
  commercialProductScore,
  loadCommercialOffer,
  mapCommercialProduct,
  normalizeCommercialText
};
