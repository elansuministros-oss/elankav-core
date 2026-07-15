import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDesignRequest,
  getDesignRequestStatus,
  hashAccessToken,
  getPublicDesignGallery,
  normalizePhone,
  validateDesignRequestPayload
} from '../services/designPortalService.js';
import {
  decodeDataUrl,
  sanitizeFileName
} from '../adapters/designPortalSupabaseAdapter.js';
import { sendDesignImageToWhatsApp } from '../services/wahaImageDeliveryService.js';

const validPayload = () => ({
  tipo: 'design-request',
  source: 'whatsapp',
  externalUserId: '50588415436',
  conversationRef: 'CRM-CONV-001',
  customer: {
    name: 'Reyna',
    businessName: 'Gimnasio Reyna',
    whatsapp: '+505 8841 5436'
  },
  project: {
    requestType: 'rotulo',
    installationEnvironment: 'exterior',
    widthCm: 100,
    heightCm: 80,
    hasLogo: false,
    needsLogoDesign: true,
    designNotes: 'Texto centrado con barra y discos.'
  },
  files: [{
    kind: 'reference',
    name: 'referencia gimnasio.png',
    dataUrl: 'data:image/png;base64,aG9sYQ=='
  }]
});

test('DESIGN-PORTAL-01 normaliza WhatsApp y datos del formulario', () => {
  const result = validateDesignRequestPayload(validPayload());

  assert.equal(normalizePhone('8841-5436'), '50588415436');
  assert.equal(result.whatsapp, '50588415436');
  assert.equal(result.requestType, 'rotulo');
  assert.equal(result.environment, 'exterior');
  assert.equal(result.widthCm, 100);
  assert.equal(result.heightCm, 80);
});

test('DESIGN-PORTAL-01 exige nombre, negocio y WhatsApp', () => {
  const payload = validPayload();
  payload.customer.name = '';

  assert.throws(
    () => validateDesignRequestPayload(payload),
    error => error.code === 'DESIGN_CUSTOMER_REQUIRED'
  );
});

test('DESIGN-PORTAL-01 no exige interior o exterior para diseñar logo', () => {
  const payload = validPayload();
  payload.project.requestType = 'logo';
  payload.project.installationEnvironment = '';

  const result = validateDesignRequestPayload(payload);

  assert.equal(result.environment, null);
  assert.equal(result.needsLogoDesign, true);
});

test('DESIGN-PORTAL-01 guarda archivos y solicitud antes de responder', async () => {
  const uploads = [];
  let inserted = null;
  const result = await createDesignRequest(validPayload(), {
    async uploadAsset(input) {
      uploads.push(input);
      return {
        kind: input.kind,
        name: 'referencia-gimnasio.png',
        mimeType: 'image/png',
        sizeBytes: 4,
        bucket: 'design-request-assets',
        path: `${input.requestCode}/reference.png`
      };
    },
    async insertRequest(row) {
      inserted = row;
      return {
        id: 'request-uuid',
        request_code: row.request_code,
        status: row.status
      };
    }
  });

  assert.equal(uploads.length, 1);
  assert.equal(inserted.status, 'ai_pending');
  assert.match(inserted.access_token_hash, /^[a-f0-9]{64}$/);
  assert.equal(typeof result.accessToken, 'string');
  assert.equal(inserted.files.length, 1);
  assert.match(result.requestCode, /^DESIGN-/);
  assert.equal(result.filesReceived, 1);
});

test('DESIGN-PIPELINE-02 consulta el resultado únicamente con token correcto', async () => {
  const accessToken = 'token-seguro-de-prueba';
  let receivedHash;
  const result = await getDesignRequestStatus({
    requestCode: 'DESIGN-TEST-ABCD',
    accessToken
  }, {
    async findRequest(input) {
      receivedHash = input.accessTokenHash;
      return {
        id: 'request-uuid',
        request_code: input.requestCode,
        status: 'review',
        delivery_status: 'delivered',
        delivered_at: '2026-07-15T00:01:00.000Z',
        completed_at: '2026-07-15T00:00:00.000Z',
        result_files: [{
          bucket: 'design-request-assets',
          path: 'DESIGN-TEST-ABCD/result.png'
        }]
      };
    },
    async signAsset(input) {
      assert.equal(input.path, 'DESIGN-TEST-ABCD/result.png');
      return 'https://storage.test/signed-result.png';
    }
  });

  assert.equal(receivedHash, hashAccessToken(accessToken));
  assert.equal(result.ready, true);
  assert.equal(result.status, 'review');
  assert.equal(result.imageUrl, 'https://storage.test/signed-result.png');
  assert.equal(result.deliveredToWhatsApp, true);
});

test('DESIGN-PIPELINE-02 entrega una sola vez la propuesta terminada por WhatsApp', async () => {
  const calls = [];
  const result = await getDesignRequestStatus({
    requestCode: 'DESIGN-TEST-ABCD',
    accessToken: 'token-seguro-de-prueba'
  }, {
    async findRequest() {
      return {
        id: 'request-uuid',
        request_code: 'DESIGN-TEST-ABCD',
        whatsapp: '50588415436',
        status: 'review',
        delivery_status: 'pending',
        delivery_attempts: 0,
        result_files: [{
          bucket: 'design-request-assets',
          path: 'DESIGN-TEST-ABCD/result.png'
        }]
      };
    },
    async signAsset() {
      return 'https://storage.test/signed-result.png';
    },
    async claimDelivery(input) {
      calls.push(['claim', input.id]);
      return { delivery_status: 'sending', delivery_attempts: 1 };
    },
    async downloadAsset(input) {
      calls.push(['download', input.path]);
      return { bytes: Buffer.from('png'), mimeType: 'image/png' };
    },
    async sendImage(input) {
      calls.push(['send', input.whatsapp, input.requestCode]);
      return { delivered: true };
    },
    async markDelivery(input) {
      calls.push(['mark', input.delivered]);
      return {
        delivery_status: 'delivered',
        delivered_at: '2026-07-15T00:02:00.000Z'
      };
    }
  });

  assert.deepEqual(calls, [
    ['claim', 'request-uuid'],
    ['download', 'DESIGN-TEST-ABCD/result.png'],
    ['send', '50588415436', 'DESIGN-TEST-ABCD'],
    ['mark', true]
  ]);
  assert.equal(result.deliveredToWhatsApp, true);
  assert.equal(result.deliveredAt, '2026-07-15T00:02:00.000Z');
});

test('DESIGN-PIPELINE-02 usa el contrato sendImage de WAHA sin URL pública', async () => {
  const previous = {
    apiKey: process.env.WAHA_API_KEY,
    baseUrl: process.env.WAHA_BASE_URL,
    session: process.env.WAHA_SESSION
  };
  process.env.WAHA_API_KEY = 'waha-test-key';
  process.env.WAHA_BASE_URL = 'https://waha.test';
  process.env.WAHA_SESSION = 'ELANKAV';

  try {
    let request;
    await sendDesignImageToWhatsApp({
      whatsapp: '+505 8841 5436',
      requestCode: 'DESIGN-TEST-ABCD',
      bytes: Buffer.from('imagen'),
      mimeType: 'image/png',
      async fetchImpl(url, options) {
        request = { url, options, body: JSON.parse(options.body) };
        return { ok: true };
      }
    });

    assert.equal(request.url, 'https://waha.test/api/sendImage');
    assert.equal(request.options.headers['X-Api-Key'], 'waha-test-key');
    assert.equal(request.body.chatId, '50588415436@c.us');
    assert.equal(request.body.file.mimetype, 'image/png');
    assert.equal(request.body.file.data, Buffer.from('imagen').toString('base64'));
    assert.equal('url' in request.body.file, false);
  } finally {
    for (const [name, value] of Object.entries({
      WAHA_API_KEY: previous.apiKey,
      WAHA_BASE_URL: previous.baseUrl,
      WAHA_SESSION: previous.session
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('DESIGN-PORTAL-01 publica únicamente el contrato seguro de galería', async () => {
  const result = await getPublicDesignGallery({
    async listGallery() {
      return [{
        id: 'gallery-1',
        title: 'Fachada comercial',
        category: 'Fachadas',
        description: 'Propuesta ACM',
        image_url: 'https://assets.elankav.com/design-1.png',
        thumbnail_url: null,
        published_at: '2026-07-15T00:00:00Z',
        private_customer_name: 'NO EXPONER'
      }];
    }
  });

  assert.deepEqual(result[0], {
    id: 'gallery-1',
    title: 'Fachada comercial',
    category: 'Fachadas',
    description: 'Propuesta ACM',
    imageUrl: 'https://assets.elankav.com/design-1.png',
    thumbnailUrl: 'https://assets.elankav.com/design-1.png',
    publishedAt: '2026-07-15T00:00:00Z'
  });
});

test('DESIGN-PORTAL-01 valida y sanea archivos', () => {
  const decoded = decodeDataUrl('data:image/png;base64,aG9sYQ==');

  assert.equal(decoded.mimeType, 'image/png');
  assert.equal(decoded.bytes.toString(), 'hola');
  assert.equal(sanitizeFileName('Mi Logo Ágil.PNG'), 'mi-logo-agil.png');
  assert.throws(
    () => decodeDataUrl('data:text/html;base64,PGgxPk5PPC9oMT4='),
    error => error.code === 'DESIGN_FILE_INVALID'
  );
});
