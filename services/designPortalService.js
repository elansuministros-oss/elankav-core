import {
  createSignedDesignAssetUrl,
  findDesignRequestByAccess,
  insertDesignRequest,
  listPublishedDesigns,
  uploadDesignAsset
} from '../adapters/designPortalSupabaseAdapter.js';
import { createHash, randomBytes } from 'node:crypto';

const REQUEST_TYPES = new Set(['rotulo', 'fachada', 'logo', 'otro']);
const ENVIRONMENTS = new Set(['interior', 'exterior']);
const FILE_KINDS = new Set(['logo', 'place', 'reference']);

function normalizeText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8 ? `505${digits}` : digits;
}

function normalizeDimension(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 100000
    ? number
    : null;
}

function generateRequestCode(now = Date.now(), uuid = crypto.randomUUID()) {
  return `DESIGN-${now.toString(36).toUpperCase()}-${uuid.slice(0, 4).toUpperCase()}`;
}

function generateAccessToken() {
  return randomBytes(32).toString('base64url');
}

function hashAccessToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function validateDesignRequestPayload(payload = {}) {
  const customer = payload.customer || {};
  const project = payload.project || {};
  const customerName = normalizeText(customer.name, 160);
  const businessName = normalizeText(customer.businessName, 200);
  const whatsapp = normalizePhone(customer.whatsapp);
  const requestType = normalizeText(project.requestType, 30).toLowerCase();
  const environment = normalizeText(project.installationEnvironment, 30).toLowerCase();
  const designNotes = normalizeText(project.designNotes, 6000);
  const files = Array.isArray(payload.files)
    ? payload.files.slice(0, 3).filter(file =>
        FILE_KINDS.has(String(file?.kind || '').toLowerCase()) &&
        file?.dataUrl
      )
    : [];

  if (!customerName || !businessName) {
    const error = new Error('Nombre del cliente y negocio son obligatorios');
    error.code = 'DESIGN_CUSTOMER_REQUIRED';
    throw error;
  }

  if (whatsapp.length < 8 || whatsapp.length > 15) {
    const error = new Error('WhatsApp inválido');
    error.code = 'DESIGN_WHATSAPP_INVALID';
    throw error;
  }

  if (!REQUEST_TYPES.has(requestType)) {
    const error = new Error('Tipo de solicitud inválido');
    error.code = 'DESIGN_REQUEST_TYPE_INVALID';
    throw error;
  }

  if (requestType !== 'logo' && !ENVIRONMENTS.has(environment)) {
    const error = new Error('Ubicación interior o exterior es obligatoria');
    error.code = 'DESIGN_ENVIRONMENT_REQUIRED';
    throw error;
  }

  if (!designNotes && files.length === 0) {
    const error = new Error('Agregá indicaciones o una referencia visual');
    error.code = 'DESIGN_CONTENT_REQUIRED';
    throw error;
  }

  return Object.freeze({
    source: normalizeText(payload.source || 'web', 40),
    externalUserId: normalizeText(payload.externalUserId, 160) || null,
    conversationRef: normalizeText(payload.conversationRef, 300) || null,
    customerName,
    businessName,
    whatsapp,
    requestType,
    environment: requestType === 'logo' ? null : environment,
    widthCm: normalizeDimension(project.widthCm),
    heightCm: normalizeDimension(project.heightCm),
    hasLogo: project.hasLogo === true,
    needsLogoDesign: project.needsLogoDesign === true || requestType === 'logo',
    designNotes,
    files
  });
}

async function createDesignRequest(payload = {}, dependencies = {}) {
  const normalized = validateDesignRequestPayload(payload);
  const requestCode = generateRequestCode();
  const accessToken = generateAccessToken();
  const upload = dependencies.uploadAsset || uploadDesignAsset;
  const insert = dependencies.insertRequest || insertDesignRequest;
  const uploadedFiles = [];

  for (const file of normalized.files) {
    uploadedFiles.push(await upload({
      requestCode,
      kind: String(file.kind).toLowerCase(),
      file
    }));
  }

  const row = {
    request_code: requestCode,
    source: normalized.source,
    external_user_id: normalized.externalUserId,
    conversation_ref: normalized.conversationRef,
    customer_name: normalized.customerName,
    business_name: normalized.businessName,
    whatsapp: normalized.whatsapp,
    request_type: normalized.requestType,
    installation_environment: normalized.environment,
    width_cm: normalized.widthCm,
    height_cm: normalized.heightCm,
    has_logo: normalized.hasLogo,
    needs_logo_design: normalized.needsLogoDesign,
    design_notes: normalized.designNotes,
    files: uploadedFiles,
    access_token_hash: hashAccessToken(accessToken),
    status: 'ai_pending'
  };
  const stored = await insert(row);

  return Object.freeze({
    id: stored.id,
    requestCode: stored.request_code || requestCode,
    accessToken,
    status: stored.status || 'ai_pending',
    whatsapp: normalized.whatsapp,
    filesReceived: uploadedFiles.length
  });
}

async function getDesignRequestStatus({ requestCode, accessToken } = {}, dependencies = {}) {
  const normalizedCode = normalizeText(requestCode, 80).toUpperCase();
  const normalizedToken = normalizeText(accessToken, 200);

  if (!/^DESIGN-[A-Z0-9]+-[A-Z0-9]{4}$/.test(normalizedCode) || !normalizedToken) {
    const error = new Error('Acceso de solicitud inválido');
    error.code = 'DESIGN_STATUS_ACCESS_INVALID';
    throw error;
  }

  const find = dependencies.findRequest || findDesignRequestByAccess;
  const sign = dependencies.signAsset || createSignedDesignAssetUrl;
  const stored = await find({
    requestCode: normalizedCode,
    accessTokenHash: hashAccessToken(normalizedToken)
  });

  if (!stored) {
    const error = new Error('Solicitud de diseño no encontrada');
    error.code = 'DESIGN_STATUS_NOT_FOUND';
    throw error;
  }

  const resultFiles = Array.isArray(stored.result_files)
    ? stored.result_files
    : [];
  const result = resultFiles[0] || null;
  const imageUrl = result?.bucket && result?.path
    ? await sign({ bucket: result.bucket, path: result.path })
    : null;

  return Object.freeze({
    requestCode: stored.request_code,
    status: stored.status,
    ready: ['review', 'approved', 'quoted', 'closed'].includes(stored.status) && Boolean(imageUrl),
    imageUrl,
    completedAt: stored.completed_at || null,
    retryable: stored.status === 'failed'
  });
}

async function getPublicDesignGallery(dependencies = {}) {
  const list = dependencies.listGallery || listPublishedDesigns;
  const items = await list();

  return items.map(item => Object.freeze({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description,
    imageUrl: item.image_url,
    thumbnailUrl: item.thumbnail_url || item.image_url,
    publishedAt: item.published_at
  }));
}

export {
  createDesignRequest,
  generateAccessToken,
  generateRequestCode,
  getDesignRequestStatus,
  getPublicDesignGallery,
  normalizeDimension,
  normalizePhone,
  hashAccessToken,
  validateDesignRequestPayload
};
