import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasApprovedTariff,
  loadCommercialOffer
} from '../services/commercialCatalogService.js';

const officialRows = [
  {
    product_id: 'lona-banner',
    platform_id: 'elanvisual',
    version: '2026-08-01',
    status: 'active',
    name: 'Lona banner',
    description: 'Impresion en lona por metro cuadrado',
    aliases: ['lona', 'banner', 'manta'],
    formula_type: 'AREA_M2',
    currency: 'USD',
    price_per_m2: 12,
    minimum_price: 25,
    source_document: 'tabla-lonas-2026',
    approved: true,
    effective_from: '2026-01-01T00:00:00Z',
    effective_to: '2099-01-01T00:00:00Z',
    contract_version: '2026-08-01'
  },
  {
    product_id: 'fachada-acm',
    platform_id: 'elanvisual',
    version: '2026-08-01',
    status: 'active',
    name: 'Fachada ACM',
    description: 'Referencia historica sin tarifa por m2 aprobada',
    aliases: ['fachada acm', 'revestimiento acm'],
    formula_type: 'AREA_M2',
    currency: 'USD',
    approved: false,
    source_document: 'referencia-historica-1450',
    commercial_rules: { referencePrice: 1450 }
  },
  {
    product_id: 'vinil-adhesivo',
    platform_id: 'elanvisual',
    version: '2025-01-01',
    status: 'active',
    name: 'Vinil adhesivo',
    description: 'Tarifa vencida',
    aliases: ['vinil'],
    formula_type: 'AREA_M2',
    currency: 'USD',
    price_per_m2: 9,
    approved: true,
    effective_to: '2020-01-01T00:00:00Z',
    source_document: 'tabla-vencida'
  }
];

test('official contract returns approved m2 tariff with source metadata', async () => {
  const result = await loadCommercialOffer(
    { message: 'Necesito una lona banner de 3x1 con ojetes' },
    { listProducts: async () => officialRows }
  );

  assert.equal(result.productId, 'lona-banner');
  assert.equal(result.formulaType, 'AREA_M2');
  assert.equal(result.calculation.pricePerM2, 12);
  assert.equal(result.priceSource.approved, true);
  assert.equal(result.priceSource.source, 'tabla-lonas-2026');
  assert.equal(result.matchedAlias, 'Lona banner');
});

test('existing product without approved tariff is not priced as official', async () => {
  const result = await loadCommercialOffer(
    { message: 'Necesito una fachada acm' },
    { listProducts: async () => officialRows }
  );

  assert.equal(result.productId, 'fachada-acm');
  assert.deepEqual(result.priceOffers, []);
  assert.equal(result.priceSource.approved, false);
  assert.equal(result.priceSource.status, 'NO_APPROVED_TARIFF');
});

test('expired tariff is filtered from official prices', async () => {
  const result = await loadCommercialOffer(
    { message: 'Quiero vinil adhesivo' },
    { listProducts: async () => officialRows }
  );

  assert.equal(result.productId, 'vinil-adhesivo');
  assert.equal(hasApprovedTariff(officialRows[2]), false);
  assert.deepEqual(result.priceOffers, []);
  assert.equal(result.priceSource.status, 'EXPIRED');
});
