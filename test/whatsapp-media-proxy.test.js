import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../services/whatsappMediaProxyService.js';
import { createSignedImageReference } from '../services/mediaReferenceService.js';

const SECRET = 'media01-test-secret-with-at-least-32-characters';

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('proxy verifica firma y descarga únicamente desde WAHA', async () => {
  const previous = {
    fetch: globalThis.fetch,
    secret: process.env.MEDIA_REFERENCE_SIGNING_SECRET,
    apiKey: process.env.WAHA_API_KEY,
    baseUrl: process.env.WAHA_BASE_URL
  };
  const signed = createSignedImageReference(
    {
      isImage: true,
      mediaUrl: 'http://localhost:3000/api/files/IMG-PROXY-001.jpg',
      mimeType: 'image/jpeg'
    },
    {
      secret: SECRET,
      publicBaseUrl: 'https://elankav-core.vercel.app'
    }
  );
  const signedUrl = new URL(signed.reference.url);
  let requestedUrl;

  process.env.MEDIA_REFERENCE_SIGNING_SECRET = SECRET;
  process.env.WAHA_API_KEY = 'waha-test-key';
  process.env.WAHA_BASE_URL = 'https://waha.elankav.com';
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    assert.equal(options.headers['X-Api-Key'], 'waha-test-key');
    const source = Buffer.from('jpeg-reference');
    return {
      ok: true,
      headers: new Headers({
        'content-type': 'image/jpeg',
        'content-length': String(source.length)
      }),
      async arrayBuffer() {
        return source;
      }
    };
  };

  try {
    const req = {
      method: 'GET',
      query: Object.fromEntries(signedUrl.searchParams.entries())
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(
      requestedUrl.toString(),
      'https://waha.elankav.com/api/files/IMG-PROXY-001.jpg'
    );
    assert.equal(res.headers['content-type'], 'image/jpeg');
    assert.deepEqual(res.payload, Buffer.from('jpeg-reference'));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [
      ['MEDIA_REFERENCE_SIGNING_SECRET', previous.secret],
      ['WAHA_API_KEY', previous.apiKey],
      ['WAHA_BASE_URL', previous.baseUrl]
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('proxy rechaza referencia alterada antes de consultar WAHA', async () => {
  const previousSecret = process.env.MEDIA_REFERENCE_SIGNING_SECRET;
  process.env.MEDIA_REFERENCE_SIGNING_SECRET = SECRET;
  let fetchCalled = false;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
  };

  try {
    const res = createResponse();
    await handler(
      {
        method: 'GET',
        query: {
          path: '/api/files/altered.jpg',
          expires: String(Math.floor(Date.now() / 1000) + 300),
          signature: '00'.repeat(32)
        }
      },
      res
    );

    assert.equal(res.statusCode, 403);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) {
      delete process.env.MEDIA_REFERENCE_SIGNING_SECRET;
    } else {
      process.env.MEDIA_REFERENCE_SIGNING_SECRET = previousSecret;
    }
  }
});
