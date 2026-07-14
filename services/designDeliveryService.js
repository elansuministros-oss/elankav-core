import {
  createCanvas,
  loadImage
} from '@napi-rs/canvas';

import {
  sendImageWithWaha
} from '../adapters/wahaImageAdapter.js';

const ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_ASSET_BASE_URL =
  'https://orchestrator.elankav.com/api/design-assets/';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

function failure(status, extra = {}) {
  return {
    ok: false,
    status,
    prepared: false,
    sent: false,
    assetId: null,
    delivery: null,
    ...extra
  };
}

function resolveAssetBaseUrl(value) {
  const raw = String(
    value ||
    globalThis.process?.env?.DESIGN_ASSET_PUBLIC_BASE_URL ||
    DEFAULT_ASSET_BASE_URL
  ).trim();

  try {
    const url = new URL(raw);
    return url.protocol === 'https:'
      ? url
      : null;
  } catch {
    return null;
  }
}

function validateAssetUrl(value, options = {}) {
  const baseUrl = resolveAssetBaseUrl(
    options.assetBaseUrl
  );

  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(String(value || ''));
    const basePath = baseUrl.pathname.endsWith('/')
      ? baseUrl.pathname
      : `${baseUrl.pathname}/`;

    if (
      url.protocol !== 'https:' ||
      url.origin !== baseUrl.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(basePath)
    ) {
      return null;
    }

    const assetId = url.pathname.slice(basePath.length);

    if (
      !ASSET_ID_PATTERN.test(assetId) ||
      assetId.includes('/')
    ) {
      return null;
    }

    return {
      assetId,
      url: url.toString()
    };
  } catch {
    return null;
  }
}

export function selectApprovedDesignAsset(
  design,
  options = {}
) {
  if (!design || typeof design !== 'object') {
    return failure('DESIGN_DELIVERY_NOT_AVAILABLE');
  }

  if (
    design.status !== 'PROCESSED' ||
    design.clientReady !== true ||
    design.qa?.approved !== true
  ) {
    return failure('DESIGN_DELIVERY_NOT_APPROVED');
  }

  if (
    !Array.isArray(design.assets) ||
    design.assets.length !== 1
  ) {
    return failure('DESIGN_DELIVERY_ASSET_COUNT_INVALID');
  }

  const asset = design.assets[0];

  if (
    asset?.type !== 'IMAGE' ||
    String(asset?.mimeType || '').toLowerCase() !== 'image/png'
  ) {
    return failure('DESIGN_DELIVERY_ASSET_TYPE_INVALID');
  }

  const validatedUrl = validateAssetUrl(
    asset.url,
    options
  );

  if (
    !validatedUrl ||
    asset.id !== validatedUrl.assetId
  ) {
    return failure('DESIGN_DELIVERY_ASSET_URL_INVALID');
  }

  return {
    ok: true,
    status: 'DESIGN_DELIVERY_ASSET_APPROVED',
    prepared: false,
    sent: false,
    assetId: validatedUrl.assetId,
    assetUrl: validatedUrl.url,
    delivery: null
  };
}

async function downloadPngAsset(
  assetUrl,
  options = {}
) {
  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    return failure('DESIGN_DELIVERY_FETCH_UNAVAILABLE');
  }

  let response;

  try {
    response = await fetchImpl(assetUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/png'
      },
      signal: AbortSignal.timeout(
        Number(options.timeoutMs) > 0
          ? Number(options.timeoutMs)
          : DEFAULT_TIMEOUT_MS
      )
    });
  } catch (error) {
    return failure(
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError'
        ? 'DESIGN_DELIVERY_ASSET_TIMEOUT'
        : 'DESIGN_DELIVERY_ASSET_FETCH_FAILED'
    );
  }

  if (!response?.ok) {
    return failure(
      'DESIGN_DELIVERY_ASSET_HTTP_ERROR',
      { httpStatus: response?.status || 500 }
    );
  }

  const contentType = String(
    response.headers?.get?.('content-type') || ''
  ).toLowerCase();

  if (!contentType.includes('image/png')) {
    return failure(
      'DESIGN_DELIVERY_ASSET_CONTENT_TYPE_INVALID'
    );
  }

  const declaredSize = Number(
    response.headers?.get?.('content-length') || 0
  );

  if (declaredSize > MAX_ASSET_BYTES) {
    return failure('DESIGN_DELIVERY_ASSET_TOO_LARGE');
  }

  let buffer;

  try {
    buffer = Buffer.from(
      await response.arrayBuffer()
    );
  } catch {
    return failure(
      'DESIGN_DELIVERY_ASSET_READ_FAILED'
    );
  }

  if (!buffer.length) {
    return failure('DESIGN_DELIVERY_ASSET_EMPTY');
  }

  if (buffer.length > MAX_ASSET_BYTES) {
    return failure('DESIGN_DELIVERY_ASSET_TOO_LARGE');
  }

  return {
    ok: true,
    buffer
  };
}

async function convertPngToJpeg(buffer) {
  const image = await loadImage(buffer);
  const width = Number(image.width);
  const height = Number(image.height);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error('IMAGE_DIMENSIONS_INVALID');
  }

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.encode('jpeg', 90);
}

export async function deliverApprovedDesign(
  input = {},
  dependencies = {}
) {
  const selected = selectApprovedDesignAsset(
    input.design,
    {
      assetBaseUrl: dependencies.assetBaseUrl
    }
  );

  if (!selected.ok) {
    return selected;
  }

  const downloaded = await downloadPngAsset(
    selected.assetUrl,
    {
      fetchImpl: dependencies.fetchImpl,
      timeoutMs: dependencies.timeoutMs
    }
  );

  if (!downloaded.ok) {
    return {
      ...downloaded,
      assetId: selected.assetId
    };
  }

  let jpegBuffer;

  try {
    const convertImage =
      dependencies.convertImage ||
      convertPngToJpeg;
    jpegBuffer = await convertImage(downloaded.buffer);
  } catch (error) {
    return failure(
      'DESIGN_DELIVERY_IMAGE_CONVERSION_FAILED',
      {
        assetId: selected.assetId,
        errorCode:
          error?.code ||
          error?.message ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  }

  if (!Buffer.isBuffer(jpegBuffer) || !jpegBuffer.length) {
    return failure(
      'DESIGN_DELIVERY_IMAGE_CONVERSION_INVALID',
      { assetId: selected.assetId }
    );
  }

  const sendImage =
    dependencies.sendImage ||
    sendImageWithWaha;

  let delivery;

  try {
    delivery = await sendImage(
      {
        chatId: input.chatId,
        session: input.session,
        caption: input.caption,
        imageBuffer: jpegBuffer,
        fileName: `elanvisual-${selected.assetId}.jpg`
      },
      dependencies.wahaOptions || {}
    );
  } catch (error) {
    return failure(
      'DESIGN_DELIVERY_WAHA_UNEXPECTED_ERROR',
      {
        assetId: selected.assetId,
        prepared: true,
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN_ERROR'
      }
    );
  }

  if (!delivery?.ok) {
    return failure(
      delivery?.status ||
      'DESIGN_DELIVERY_WAHA_FAILED',
      {
        assetId: selected.assetId,
        prepared: true,
        delivery: delivery || null
      }
    );
  }

  return {
    ok: true,
    status: 'DESIGN_IMAGE_DELIVERED',
    prepared: true,
    sent: true,
    assetId: selected.assetId,
    sourceMimeType: 'image/png',
    deliveredMimeType: 'image/jpeg',
    sizeBytes: jpegBuffer.length,
    delivery: {
      provider: delivery.provider,
      status: delivery.status,
      messageId: delivery.messageId || null
    }
  };
}
import { Buffer } from 'node:buffer';
