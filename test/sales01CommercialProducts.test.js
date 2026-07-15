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
    product_id: 'boton-acrilico',
    platform_id: 'elanvisual',
    version: 'ECL-001A',
    status: 'active',
    name: 'Rótulo estilo botón en acrílico',
    description: 'Rótulo en acrílico transparente de 3 mm',
    aliases: [
      'rótulo estilo botón',
      'rótulo botón',
      'botón acrílico'
    ],
    specifications: { baseCm: 60, primaryMaterial: 'acrílico transparente' },
    price_offers: [
      { label: 'Botón Transparente 60 cm', amount: 100, currency: 'USD', mode: 'reference' },
      { label: 'Botón con Impresión 60 cm', amount: 130, currency: 'USD', mode: 'reference' }
    ],
    sales_guidance: { qualificationQuestion: '¿Lo querés transparente o con impresión?' },
    commercial_rules: { maxQuestionsPerReply: 1 }
  },
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

test('SALES-01 reconoce los cinco productos desde Supabase', async () => {
  const listProducts = async () => ROWS;
  const cases = [
    ['Quiero cotizar un rótulo en acrílico estilo botón', 'boton-acrilico'],
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

test('SALES-UX-01 reconoce palabras separadas dentro del nombre comercial', async () => {
  const result = await loadCommercialOffer(
    { message: 'Hola, quiero cotizar un rótulo en acrílico estilo botón para mi negocio' },
    { listProducts: async () => ROWS }
  );

  assert.equal(result.productId, 'boton-acrilico');
  assert.deepEqual(result.priceOffers.map(item => item.amount), [100, 130]);
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
