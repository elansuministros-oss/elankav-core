import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import {
  deliverApprovedDesign,
  selectApprovedDesignAsset
} from '../services/designDeliveryService.js';

const ASSET_ID =
  '77777777-7777-4777-8777-777777777777';

function approvedDesign(overrides = {}) {
  return {
    status: 'PROCESSED',
    clientReady: true,
    qa: { approved: true },
    assets: [{
      id: ASSET_ID,
      type: 'IMAGE',
      mimeType: 'image/png',
      url:
        `https://orchestrator.elankav.com/api/design-assets/${ASSET_ID}`
    }],
    ...overrides
  };
}

test('nunca entrega un diseño sin aprobación QA', () => {
  const result = selectApprovedDesignAsset(
    approvedDesign({ qa: { approved: false } })
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'DESIGN_DELIVERY_NOT_APPROVED');
});

test('rechaza URLs externas aunque el diseño esté aprobado', () => {
  const result = selectApprovedDesignAsset(
    approvedDesign({
      assets: [{
        id: ASSET_ID,
        type: 'IMAGE',
        mimeType: 'image/png',
        url: `https://example.com/api/design-assets/${ASSET_ID}`
      }]
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'DESIGN_DELIVERY_ASSET_URL_INVALID');
});

test('descarga PNG aprobado, convierte a JPEG y lo entrega', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  let sent = null;

  const result = await deliverApprovedDesign(
    {
      design: approvedDesign(),
      caption: 'Preparé una propuesta visual para tu proyecto.',
      chatId: '50500000000@c.us',
      session: 'ELANKAV'
    },
    {
      fetchImpl: async url => {
        assert.equal(
          url,
          `https://orchestrator.elankav.com/api/design-assets/${ASSET_ID}`
        );

        return new Response(
          Buffer.from('PNG-DATA'),
          {
            status: 200,
            headers: {
              'content-type': 'image/png',
              'content-length': '8'
            }
          }
        );
      },
      convertImage: async png => {
        assert.equal(png.toString(), 'PNG-DATA');
        return jpeg;
      },
      sendImage: async input => {
        sent = input;
        return {
          ok: true,
          status: 'WAHA_IMAGE_SENT',
          provider: 'waha',
          messageId: 'IMAGE-DELIVERY-001'
        };
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'DESIGN_IMAGE_DELIVERED');
  assert.equal(result.sent, true);
  assert.equal(result.assetId, ASSET_ID);
  assert.equal(result.deliveredMimeType, 'image/jpeg');
  assert.equal(sent.caption, 'Preparé una propuesta visual para tu proyecto.');
  assert.deepEqual(sent.imageBuffer, jpeg);
  assert.equal(sent.fileName, `elanvisual-${ASSET_ID}.jpg`);
});

test('no intenta enviar si el asset no es PNG', async () => {
  let sendCalled = false;

  const result = await deliverApprovedDesign(
    {
      design: approvedDesign({
        assets: [{
          id: ASSET_ID,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          url:
            `https://orchestrator.elankav.com/api/design-assets/${ASSET_ID}`
        }]
      })
    },
    {
      sendImage: async () => {
        sendCalled = true;
      }
    }
  );

  assert.equal(result.status, 'DESIGN_DELIVERY_ASSET_TYPE_INVALID');
  assert.equal(sendCalled, false);
});

test('rechaza respuesta de asset con content-type inesperado', async () => {
  const result = await deliverApprovedDesign(
    { design: approvedDesign() },
    {
      fetchImpl: async () => new Response(
        '<html>error</html>',
        {
          status: 200,
          headers: {
            'content-type': 'text/html'
          }
        }
      )
    }
  );

  assert.equal(
    result.status,
    'DESIGN_DELIVERY_ASSET_CONTENT_TYPE_INVALID'
  );
  assert.equal(result.sent, false);
});
