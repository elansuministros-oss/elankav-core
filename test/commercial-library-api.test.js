import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/commercial-library.js';

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('API comercial expone únicamente consulta GET', () => {
  const res = createResponse();

  handler(
    { method: 'POST', query: {} },
    res
  );

  assert.equal(res.statusCode, 405);
  assert.equal(res.payload.error, 'METHOD_NOT_ALLOWED');
  assert.equal(res.headers.Allow, 'GET');
});

test('API comercial devuelve precios oficiales por medida', () => {
  const res = createResponse();

  handler(
    {
      method: 'GET',
      query: {
        productId: 'boton-acrilico',
        sizeCm: '70'
      }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.result.productId, 'boton-acrilico');
  assert.deepEqual(
    res.payload.result.variants.map(item => item.quote.total),
    [120, 150, 170, 210]
  );
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('API comercial no inventa productos desconocidos', () => {
  const res = createResponse();

  handler(
    {
      method: 'GET',
      query: { productId: 'jala-vista' }
    },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.error, 'PRODUCT_NOT_FOUND');
});
