import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHeaders
} from '../adapters/commercialSupabaseAdapter.js';
import {
  loadCommercialOffer
} from '../services/commercialCatalogService.js';
import {
  createCommercialLibraryHandler
} from '../api/commercial-library.js';

const ROWS = [
  {
    product_id: 'rotulo-jala-vista',
    platform_id: 'elanvisual',
    version: 'SALES-01A',
    status: 'active',
    name: 'Rótulo jala vista',
    description: 'Doble cara',
    aliases: ['jala vista', 'rótulo doble cara'],
    specifications: { baseWidthCm: 60, baseHeightCm: 60, faces: 2 },
    price_offers: [
      { amount: 260, currency: 'USD', mode: 'reference', approximate: true }
    ],
    sales_guidance: { qualificationQuestion: '¿Ya tenés el logo?' },
    commercial_rules: { paymentAdvancePercent: 60, maxQuestionsPerReply: 1 }
  },
  {
    product_id: 'rotulo-cajuela',
    platform_id: 'elanvisual',
    version: 'SALES-01B',
    status: 'active',
    name: 'Rótulo de cajuela',
    description: 'Una cara',
    aliases: ['rótulo de cajuela', 'caja de luz'],
    specifications: { minimumWidthCm: 120, minimumHeightCm: 120, faces: 1 },
    price_offers: [
      { environment: 'interior', amount: 360, currency: 'USD', mode: 'starting-at' },
      { environment: 'exterior', amount: 560, currency: 'USD', mode: 'starting-at' }
    ],
    sales_guidance: { qualificationQuestion: '¿Interior o exterior?' },
    commercial_rules: { priceIsApproximate: true }
  },
  {
    product_id: 'fascia-pvc-3d',
    platform_id: 'elanvisual',
    version: 'SALES-01C',
    status: 'active',
    name: 'Fascia con letras PVC 3D',
    description: 'Fascia comercial',
    aliases: ['fascia pvc', 'fascia con letras pvc', 'letras pvc 3d'],
    specifications: { letters: 'PVC 3D' },
    price_offers: [{ amount: 600, currency: 'USD', mode: 'starting-at' }],
    sales_guidance: { qualificationQuestion: '¿Qué medidas tiene?' },
    commercial_rules: { priceIsApproximate: true }
  },
  {
    product_id: 'fachada-acm-luz',
    platform_id: 'elanvisual',
    version: 'SALES-01D',
    status: 'active',
    name: 'Fachada ACM con letras 3D iluminadas',
    description: 'Fachada iluminada',
    aliases: ['fachada acm', 'acm con letras'],
    specifications: { cladding: 'ACM', lighting: true },
    price_offers: [{ amount: 1450, currency: 'USD', mode: 'starting-at' }],
    sales_guidance: { qualificationQuestion: '¿Qué medidas tiene?' },
    commercial_rules: { priceIsApproximate: true }
  }
];

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('SALES-01 reconoce los cuatro productos desde Supabase', async () => {
  const listProducts = async () => ROWS;
  const cases = [
    ['Quiero un jala vista doble cara', 'rotulo-jala-vista'],
    ['Cuánto vale el rótulo de cajuela exterior', 'rotulo-cajuela'],
    ['Necesito una fascia con letras PVC', 'fascia-pvc-3d'],
    ['Quiero fachada ACM con letras y luz', 'fachada-acm-luz']
  ];

  for (const [message, expected] of cases) {
    const result = await loadCommercialOffer(
      { message },
      { listProducts }
    );
    assert.equal(result.productId, expected);
  }
});

test('SALES-01 conserva precios y modalidad exactos', async () => {
  const listProducts = async () => ROWS;
  const cajuela = await loadCommercialOffer(
    { productId: 'rotulo-cajuela' },
    { listProducts }
  );

  assert.deepEqual(cajuela.priceOffers.map(item => item.amount), [360, 560]);
  assert.ok(cajuela.priceOffers.every(item => item.mode === 'starting-at'));
});

test('SALES-01 API usa el catálogo inyectado y no inventa productos', async () => {
  const handler = createCommercialLibraryHandler({
    loadOffer: input => loadCommercialOffer(input, {
      listProducts: async () => ROWS
    })
  });
  const found = createResponse();

  await handler(
    { method: 'GET', query: { message: 'Me interesa una fachada ACM' } },
    found
  );

  assert.equal(found.statusCode, 200);
  assert.equal(found.payload.result.productId, 'fachada-acm-luz');

  const missing = createResponse();
  await handler(
    { method: 'GET', query: { message: 'Quiero camisetas' } },
    missing
  );
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.payload.error, 'PRODUCT_NOT_FOUND');
});

test('SALES-01 secret key moderna no se envía como Bearer', () => {
  assert.deepEqual(createHeaders('sb_secret_example'), {
    apikey: 'sb_secret_example'
  });
  assert.equal(
    createHeaders('a.b.c').Authorization,
    'Bearer a.b.c'
  );
});

test('SALES-01 API degrada si Supabase no está disponible', async () => {
  const handler = createCommercialLibraryHandler({
    loadOffer: async () => {
      const error = new Error('sin conexión');
      error.code = 'COMMERCIAL_SUPABASE_UNAVAILABLE';
      throw error;
    }
  });
  const res = createResponse();

  await handler(
    { method: 'GET', query: { message: 'jala vista' } },
    res
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error, 'COMMERCIAL_LIBRARY_UNAVAILABLE');
});

test('SALES-01 migración protege y carga los precios oficiales', () => {
  const sql = fs.readFileSync(
    new URL(
      '../supabase/migrations/20260714_sales_01_commercial_products.sql',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all.*anon, authenticated/i);
  assert.match(sql, /'rotulo-jala-vista'/);
  assert.match(sql, /customLogoSilhouette/);
  assert.match(sql, /layeredRelief/);
  assert.match(sql, /integratedLighting/);
  assert.match(sql, /materialRequiresValidation/);
  assert.match(sql, /"amount":260/);
  assert.match(sql, /"amount":360/);
  assert.match(sql, /"amount":560/);
  assert.match(sql, /"amount":600/);
  assert.match(sql, /"amount":1450/);
});
