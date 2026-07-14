import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePrice,
  getCommercialOffer,
  getProduct,
  getRenderPrompt,
  getSalesFlow
} from '../services/commercialLibraryService.js';

test('ECL registra botón acrílico con material de 3 mm', () => {
  const product = getProduct('boton-acrilico');

  assert.equal(product.materialRules.thicknessMm, 3);
  assert.equal(product.dimensions.baseCm, 60);
  assert.equal(product.dimensions.maxStandardCm, 120);
});

test('ECL calcula botón transparente de 60 cm en USD 100', () => {
  const result = calculatePrice({
    productId: 'boton-acrilico',
    variantId: 'boton-transparente',
    sizeCm: 60
  });

  assert.equal(result.status, 'priced');
  assert.equal(result.total, 100);
});

test('ECL suma USD 20 por cada 10 cm adicionales', () => {
  const seventy = calculatePrice({
    productId: 'boton-acrilico',
    variantId: 'boton-transparente',
    sizeCm: 70
  });
  const eighty = calculatePrice({
    productId: 'boton-acrilico',
    variantId: 'boton-transparente',
    sizeCm: 80
  });

  assert.equal(seventy.total, 120);
  assert.equal(eighty.total, 140);
});

test('ECL envía medidas no estándar a revisión manual', () => {
  const result = calculatePrice({
    productId: 'boton-acrilico',
    variantId: 'boton-transparente',
    sizeCm: 75
  });

  assert.equal(result.status, 'manual-review');
  assert.equal(result.reason, 'NON_STANDARD_SIZE_STEP');
});

test('ECL contiene prompt y flujo sin inventar especificaciones', () => {
  const prompt = getRenderPrompt({
    productId: 'boton-acrilico',
    variantId: 'boton-premium-combinado'
  });
  const flow = getSalesFlow('boton-acrilico');

  assert.match(prompt.prompt, /3 mm/);
  assert.equal(flow.productId, 'boton-acrilico');
});

test('ECL publica oferta comercial oficial del botón', () => {
  const offer = getCommercialOffer({
    productId: 'boton-acrilico'
  });

  assert.equal(offer.source, 'ELANKAV Commercial Library');
  assert.equal(offer.effectiveSizeCm, 60);
  assert.equal(offer.baseSizeUsed, true);
  assert.equal(offer.materialRules.thicknessMm, 3);
  assert.equal(offer.variants.length, 4);
  assert.deepEqual(
    offer.variants.map(item => item.quote.total),
    [100, 130, 150, 190]
  );
  assert.equal(offer.commercialRules.paymentAdvancePercent, 60);
  assert.equal(offer.commercialRules.paymentBalancePercent, 40);
});

test('ECL calcula todas las variantes para una medida solicitada', () => {
  const offer = getCommercialOffer({
    productId: 'boton-acrilico',
    sizeCm: 70
  });

  assert.equal(offer.requestedSizeCm, 70);
  assert.equal(offer.baseSizeUsed, false);
  assert.deepEqual(
    offer.variants.map(item => item.quote.total),
    [120, 150, 170, 210]
  );
});

test('ECL manda medidas intermedias a revisión manual', () => {
  const offer = getCommercialOffer({
    productId: 'boton-acrilico',
    sizeCm: 65
  });

  assert.equal(
    offer.variants.every(item => item.quote.status === 'manual-review'),
    true
  );
});
