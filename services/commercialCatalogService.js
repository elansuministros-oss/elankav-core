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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isExpired(row, now = new Date()) {
  if (!row.effective_to) return false;
  const expires = new Date(row.effective_to).getTime();
  return Number.isFinite(expires) && expires < now.getTime();
}

function hasApprovedTariff(row, now = new Date()) {
  const approved = row.approved !== false && row.publication_status !== 'DEACTIVATED';
  if (!approved || isExpired(row, now)) return false;

  return [
    row.base_price,
    row.price_per_m2,
    row.price_per_linear_meter,
    row.unit_price,
    row.minimum_price,
    row.fixed_cost,
    row.variable_cost
  ].some(value => Number.isFinite(Number(value))) || (
    Array.isArray(row.price_offers) &&
    row.price_offers.some(offer =>
      Number.isFinite(Number(offer?.amount)) &&
      offer?.approved !== false &&
      (!offer?.effectiveTo || new Date(offer.effectiveTo).getTime() >= now.getTime())
    )
  );
}

function resolvePriceOffers(row, now = new Date()) {
  if (!hasApprovedTariff(row, now)) return [];
  if (Array.isArray(row.price_offers) && row.price_offers.length) {
    return row.price_offers.filter(offer =>
      Number.isFinite(Number(offer?.amount)) &&
      offer?.approved !== false &&
      (!offer?.effectiveTo || new Date(offer.effectiveTo).getTime() >= now.getTime())
    );
  }

  const amount =
    numberOrNull(row.base_price) ??
    numberOrNull(row.unit_price) ??
    numberOrNull(row.minimum_price) ??
    numberOrNull(row.price_per_m2) ??
    numberOrNull(row.price_per_linear_meter);

  return amount === null ? [] : [{
    amount,
    currency: row.currency || 'USD',
    mode: row.formula_type || row.commercial_rules?.formulaType || 'PRECIO_FIJO',
    approved: true,
    sourceDocument: row.source_document || null,
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null
  }];
}

function mapCommercialProduct(row, { matchedAlias = null, score = 0, alternatives = [] } = {}) {
  const formulaType = row.formula_type || row.commercial_rules?.formulaType || null;
  const approvedTariff = hasApprovedTariff(row);
  const priceOffers = resolvePriceOffers(row);

  return Object.freeze({
    status: 'active',
    source: 'Supabase Commercial Products',
    productId: row.product_id,
    platformId: row.platform_id,
    productVersion: row.version,
    productName: row.name,
    description: row.description,
    category: row.category || row.specifications?.category || null,
    subcategory: row.subcategory || row.specifications?.subcategory || null,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    specifications: row.specifications || {},
    priceOffers,
    salesGuidance: row.sales_guidance || {},
    commercialRules: row.commercial_rules || {}
      ? {
          ...(row.commercial_rules || {}),
          formulaType,
          basePrice: numberOrNull(row.base_price ?? row.commercial_rules?.basePrice),
          baseWidth: numberOrNull(row.base_width ?? row.commercial_rules?.baseWidth),
          baseHeight: numberOrNull(row.base_height ?? row.commercial_rules?.baseHeight),
          baseAreaM2: numberOrNull(row.base_area_m2 ?? row.commercial_rules?.baseAreaM2),
          pricePerM2: numberOrNull(row.price_per_m2 ?? row.commercial_rules?.pricePerM2),
          pricePerLinearMeter: numberOrNull(row.price_per_linear_meter ?? row.commercial_rules?.pricePerLinearMeter),
          unitPrice: numberOrNull(row.unit_price ?? row.commercial_rules?.unitPrice),
          minimumPrice: numberOrNull(row.minimum_price ?? row.commercial_rules?.minimumPrice),
          fixedCost: numberOrNull(row.fixed_cost ?? row.commercial_rules?.fixedCost),
          variableCost: numberOrNull(row.variable_cost ?? row.commercial_rules?.variableCost)
        }
      : {},
    formulaType,
    calculation: {
      formulaType,
      basePrice: numberOrNull(row.base_price),
      baseWidth: numberOrNull(row.base_width),
      baseHeight: numberOrNull(row.base_height),
      baseAreaM2: numberOrNull(row.base_area_m2),
      pricePerM2: numberOrNull(row.price_per_m2),
      pricePerLinearMeter: numberOrNull(row.price_per_linear_meter),
      unitPrice: numberOrNull(row.unit_price),
      minimumPrice: numberOrNull(row.minimum_price),
      fixedCost: numberOrNull(row.fixed_cost),
      variableCost: numberOrNull(row.variable_cost)
    },
    priceSource: {
      source: row.source_document || row.sourceDocument || 'commercial_products',
      sourceCatalogId: row.source_catalog_id || null,
      approved: approvedTariff,
      effectiveFrom: row.effective_from || null,
      effectiveTo: row.effective_to || null,
      version: row.contract_version || row.version || null,
      status: approvedTariff ? 'OFFICIAL' : isExpired(row) ? 'EXPIRED' : 'NO_APPROVED_TARIFF'
    },
    matchedAlias,
    score,
    alternatives
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
  const candidates = [row.name, row.product_id, ...aliases]
    .map(alias => ({ alias, score: commercialAliasScore(normalizedMessage, alias) }))
    .sort((left, right) => right.score - left.score);
  return candidates[0]?.score || 0;
}

function commercialProductMatch(row, normalizedMessage) {
  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
  const candidates = [row.name, row.product_id, ...aliases]
    .map(alias => ({ alias, score: commercialAliasScore(normalizedMessage, alias) }))
    .sort((left, right) => right.score - left.score);
  return candidates[0] || { alias: null, score: 0 };
}

async function loadCommercialOffer(
  { productId, message } = {},
  { listProducts = listCommercialProducts } = {}
) {
  const rows = await listProducts();
  const normalizedProductId = String(productId || '').trim();
  const normalizedMessage = normalizeCommercialText(message);
  const candidates = normalizedProductId
    ? rows
        .filter(item => item.product_id === normalizedProductId)
        .map(item => ({
          item,
          matchedAlias: item.product_id,
          score: 2000
        }))
    : rows
        .map(item => {
          const match = commercialProductMatch(item, normalizedMessage);
          return {
            item,
            matchedAlias: match.alias,
            score: match.score
          };
        })
        .filter(candidate => candidate.score > 0)
        .sort((left, right) => right.score - left.score);

  const [selected] = candidates;
  if (!selected) return null;

  const alternatives = candidates
    .slice(1, 6)
    .map(candidate => ({
      productId: candidate.item.product_id,
      productName: candidate.item.name,
      matchedAlias: candidate.matchedAlias,
      score: candidate.score,
      formulaType: candidate.item.formula_type || candidate.item.commercial_rules?.formulaType || null,
      approved: hasApprovedTariff(candidate.item)
    }));

  return mapCommercialProduct(selected.item, {
    matchedAlias: selected.matchedAlias,
    score: selected.score,
    alternatives
  });
}

export {
  commercialAliasScore,
  commercialProductScore,
  commercialProductMatch,
  hasApprovedTariff,
  loadCommercialOffer,
  mapCommercialProduct,
  normalizeCommercialText
};
