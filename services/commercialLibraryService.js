import { BUTTON_ACRYLIC_PRODUCT } from '../commercial-library/products/boton-acrilico/product.js';
import { BUTTON_ACRYLIC_PROMPTS } from '../commercial-library/products/boton-acrilico/prompts.js';
import { BUTTON_ACRYLIC_SALES_FLOW } from '../commercial-library/products/boton-acrilico/sales-flow.js';

const PRODUCTS = Object.freeze({
  [BUTTON_ACRYLIC_PRODUCT.id]: BUTTON_ACRYLIC_PRODUCT
});

function getProduct(productId) {
  const product = PRODUCTS[String(productId || '').trim()];

  if (!product) {
    throw new Error(`Producto comercial no registrado: ${productId}`);
  }

  return product;
}

function getVariant(productId, variantId) {
  const product = getProduct(productId);
  const variant = product.variants.find(item => item.id === variantId);

  if (!variant) {
    throw new Error(
      `Variante no registrada para ${productId}: ${variantId}`
    );
  }

  return variant;
}

function calculatePrice({ productId, variantId, sizeCm }) {
  const product = getProduct(productId);
  const variant = getVariant(productId, variantId);
  const size = Number(sizeCm);
  const rule = product.pricingRule;

  if (!Number.isFinite(size)) {
    throw new TypeError('sizeCm debe ser un número válido');
  }

  if (
    size < product.dimensions.baseCm ||
    size > product.dimensions.maxStandardCm
  ) {
    return Object.freeze({
      status: 'manual-review',
      reason: 'SIZE_OUTSIDE_STANDARD_RANGE',
      productId,
      variantId,
      sizeCm: size,
      currency: rule.currency
    });
  }

  const difference = size - rule.baseSizeCm;

  if (difference % rule.incrementEveryCm !== 0) {
    return Object.freeze({
      status: 'manual-review',
      reason: 'NON_STANDARD_SIZE_STEP',
      productId,
      variantId,
      sizeCm: size,
      currency: rule.currency
    });
  }

  const increments = difference / rule.incrementEveryCm;
  const incrementTotal = increments * rule.incrementAmount;
  const total = variant.basePrice + incrementTotal;

  return Object.freeze({
    status: 'priced',
    productId,
    productName: product.name,
    variantId,
    variantName: variant.commercialName,
    sizeCm: size,
    baseSizeCm: rule.baseSizeCm,
    basePrice: variant.basePrice,
    increments,
    incrementAmount: rule.incrementAmount,
    incrementTotal,
    total,
    currency: rule.currency
  });
}

function getRenderPrompt({ productId, variantId }) {
  const variant = getVariant(productId, variantId);
  const prompt = BUTTON_ACRYLIC_PROMPTS[variant.renderPromptId];

  if (!prompt) {
    throw new Error(
      `Prompt no registrado para ${productId}/${variantId}`
    );
  }

  return prompt;
}

function getSalesFlow(productId) {
  getProduct(productId);

  if (productId === 'boton-acrilico') {
    return BUTTON_ACRYLIC_SALES_FLOW;
  }

  throw new Error(`Flujo comercial no registrado: ${productId}`);
}

export {
  calculatePrice,
  getProduct,
  getRenderPrompt,
  getSalesFlow,
  getVariant
};
