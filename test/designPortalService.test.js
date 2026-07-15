import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDesignRequest,
  getPublicDesignGallery,
  normalizePhone,
  validateDesignRequestPayload
} from '../services/designPortalService.js';
import {
  decodeDataUrl,
  sanitizeFileName
} from '../adapters/designPortalSupabaseAdapter.js';

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
  assert.equal(inserted.files.length, 1);
  assert.match(result.requestCode, /^DESIGN-/);
  assert.equal(result.filesReceived, 1);
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
