import {
  claimDesignDelivery,
  createSignedDesignAssetUrl,
  downloadDesignAsset,
  findDesignRequestByAccess,
  insertDesignRequest,
  listPublishedDesigns,
  markDesignDelivery,
  recoverStaleDesignDelivery,
  updateDesignRequestByAccess,
  uploadDesignAsset
} from '../adapters/designPortalSupabaseAdapter.js';
import { createHash, randomBytes } from 'node:crypto';
import { sendDesignImageToWhatsApp } from './wahaImageDeliveryService.js';

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

function validateDesignFollowupPayload(payload = {}) {
  const action = normalizeText(payload.action, 30).toLowerCase();
  const instructions = normalizeText(payload.instructions, 4000);
  const project = payload.project || {};
  const requestType = normalizeText(project.requestType, 30).toLowerCase();
  const environment = normalizeText(project.installationEnvironment, 30).toLowerCase();
  const files = Array.isArray(payload.files)
    ? payload.files.slice(0, 2).filter(file =>
        ['place', 'reference'].includes(String(file?.kind || '').toLowerCase()) &&
        file?.dataUrl
      )
    : [];

  if (!['revision', 'render'].includes(action)) {
    const error = new Error('Acción de seguimiento inválida');
    error.code = 'DESIGN_FOLLOWUP_ACTION_INVALID';
    throw error;
  }

  if (!instructions) {
    const error = new Error(
      action === 'revision'
        ? 'Describí los cambios que necesitás'
        : 'Indicá cómo querés presentar el render'
    );
    error.code = 'DESIGN_FOLLOWUP_INSTRUCTIONS_REQUIRED';
    throw error;
  }

  if (action === 'render' && !['rotulo', 'fachada'].includes(requestType)) {
    const error = new Error('Elegí si el render será de rótulo o fachada');
    error.code = 'DESIGN_FOLLOWUP_RENDER_TYPE_REQUIRED';
    throw error;
  }

  if (action === 'render' && !ENVIRONMENTS.has(environment)) {
    const error = new Error('Elegí si el render será para interior o exterior');
    error.code = 'DESIGN_FOLLOWUP_ENVIRONMENT_REQUIRED';
    throw error;
  }

  return Object.freeze({
    action,
    instructions,
    requestType: action === 'render' ? requestType : null,
    environment: action === 'render' ? environment : null,
    widthCm: action === 'render' ? normalizeDimension(project.widthCm) : null,
    heightCm: action === 'render' ? normalizeDimension(project.heightCm) : null,
    files
  });
}

async function continueDesignRequest(payload = {}, dependencies = {}) {
  const requestCode = normalizeText(payload.requestCode, 80).toUpperCase();
  const accessToken = normalizeText(payload.accessToken, 200);

  if (!/^DESIGN-[A-Z0-9]+-[A-Z0-9]{4}$/.test(requestCode) || !accessToken) {
    const error = new Error('Acceso de solicitud inválido');
    error.code = 'DESIGN_STATUS_ACCESS_INVALID';
    throw error;
  }

  const followup = validateDesignFollowupPayload(payload);
  const accessTokenHash = hashAccessToken(accessToken);
  const find = dependencies.findRequest || findDesignRequestByAccess;
  const updateRequest = dependencies.updateRequest || updateDesignRequestByAccess;
  const upload = dependencies.uploadAsset || uploadDesignAsset;
  const stored = await find({ requestCode, accessTokenHash });

  if (!stored) {
    const error = new Error('Solicitud de diseño no encontrada');
    error.code = 'DESIGN_STATUS_NOT_FOUND';
    throw error;
  }

  if (!['review', 'approved', 'quoted', 'closed', 'failed'].includes(stored.status)) {
    const error = new Error('La solicitud todavía está en proceso');
    error.code = 'DESIGN_FOLLOWUP_NOT_READY';
    throw error;
  }

  const currentResults = Array.isArray(stored.result_files)
    ? stored.result_files
    : [];
  const primaryResult = currentResults[0];

  if (!primaryResult?.bucket || !primaryResult?.path) {
    const error = new Error('La solicitud no tiene un diseño para continuar');
    error.code = 'DESIGN_FOLLOWUP_RESULT_REQUIRED';
    throw error;
  }

  const uploadedFiles = [];
  for (const file of followup.files) {
    uploadedFiles.push(await upload({
      requestCode,
      kind: String(file.kind).toLowerCase(),
      file
    }));
  }

  const previousAsInput = {
    ...primaryResult,
    kind: followup.action === 'render' ? 'logo' : 'reference',
    name: followup.action === 'render'
      ? 'logo-aprobado.png'
      : 'propuesta-anterior.png'
  };
  const revisionNumber = Number(stored.revision_number || 1) + 1;
  const history = [
    ...(Array.isArray(stored.version_history) ? stored.version_history : []),
    {
      revisionNumber: Number(stored.revision_number || 1),
      workflowStage: stored.workflow_stage || 'concept',
      requestType: stored.request_type,
      completedAt: stored.completed_at || null,
      resultFiles: currentResults
    }
  ].slice(-20);
  const isRender = followup.action === 'render';
  const designNotes = isRender
    ? [
        'Crear un render comercial hiperrealista.',
        'Mantener exactamente la identidad, composición y colores del logotipo aprobado.',
        `Indicaciones del cliente: ${followup.instructions}`
      ].join(' ')
    : `Modificar la propuesta existente. Cambios solicitados por el cliente: ${followup.instructions}`;
  const values = {
    status: 'ai_pending',
    workflow_stage: isRender ? 'render' : 'revision',
    revision_number: revisionNumber,
    version_history: history,
    request_type: isRender ? followup.requestType : stored.request_type,
    installation_environment: isRender ? followup.environment : stored.installation_environment,
    width_cm: isRender ? followup.widthCm : stored.width_cm,
    height_cm: isRender ? followup.heightCm : stored.height_cm,
    has_logo: isRender ? true : stored.has_logo,
    needs_logo_design: isRender ? false : stored.request_type === 'logo',
    design_notes: designNotes,
    files: [previousAsInput, ...uploadedFiles],
    processing_attempts: 0,
    processing_started_at: null,
    completed_at: null,
    last_error_code: null,
    delivery_status: 'pending',
    delivery_attempts: 0,
    delivery_started_at: null,
    delivery_error_code: null,
    delivered_at: null,
    updated_at: new Date().toISOString()
  };
  const updated = await updateRequest({
    requestCode,
    accessTokenHash,
    values
  });

  if (!updated) {
    const error = new Error('La solicitud cambió antes de poder actualizarla');
    error.code = 'DESIGN_FOLLOWUP_CONFLICT';
    throw error;
  }

  return Object.freeze({
    requestCode,
    status: updated.status || 'ai_pending',
    action: followup.action,
    workflowStage: values.workflow_stage,
    revisionNumber,
    whatsapp: stored.whatsapp
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
  const ready = ['review', 'approved', 'quoted', 'closed'].includes(stored.status) && Boolean(imageUrl);
  let deliveryStatus = stored.delivery_status || 'pending';
  let deliveredAt = stored.delivered_at || null;
  let deliveryAttempts = Number(stored.delivery_attempts || 0);

  if (ready && result?.bucket && result?.path && deliveryStatus !== 'delivered') {
    const recover = dependencies.recoverDelivery || recoverStaleDesignDelivery;
    const claim = dependencies.claimDelivery || claimDesignDelivery;
    const download = dependencies.downloadAsset || downloadDesignAsset;
    const sendImage = dependencies.sendImage || sendDesignImageToWhatsApp;
    const mark = dependencies.markDelivery || markDesignDelivery;
    let deliveryRow = stored;

    if (deliveryStatus === 'sending') {
      const recovered = await recover({
        id: stored.id,
        startedAt: stored.delivery_started_at
      });

      if (recovered) {
        deliveryRow = recovered;
        deliveryStatus = recovered.delivery_status;
        deliveryAttempts = Number(recovered.delivery_attempts || deliveryAttempts);
      }
    }

    if (
      ['pending', 'failed'].includes(deliveryStatus) &&
      Number(deliveryRow.delivery_attempts || 0) < 3
    ) {
      const claimed = await claim({
        id: stored.id,
        attempts: deliveryRow.delivery_attempts
      });

      if (claimed) {
        deliveryStatus = 'sending';
        deliveryAttempts = Number(claimed.delivery_attempts || deliveryAttempts + 1);

        try {
          const asset = await download({
            bucket: result.bucket,
            path: result.path
          });
          await sendImage({
            whatsapp: stored.whatsapp,
            requestCode: stored.request_code,
            bytes: asset.bytes,
            mimeType: asset.mimeType
          });
          const delivered = await mark({ id: stored.id, delivered: true });
          deliveryStatus = delivered?.delivery_status || 'delivered';
          deliveredAt = delivered?.delivered_at || new Date().toISOString();
        } catch (error) {
          await mark({
            id: stored.id,
            delivered: false,
            errorCode: error?.code || 'DESIGN_DELIVERY_FAILED'
          });
          deliveryStatus = 'failed';
        }
      }
    }
  }

  return Object.freeze({
    requestCode: stored.request_code,
    status: stored.status,
    ready,
    imageUrl,
    completedAt: stored.completed_at || null,
    retryable: stored.status === 'failed',
    deliveryStatus,
    deliveredToWhatsApp: deliveryStatus === 'delivered',
    deliveryPending:
      ready && deliveryStatus !== 'delivered' && deliveryAttempts < 3,
    deliveredAt,
    workflowStage: stored.workflow_stage || 'concept',
    revisionNumber: Number(stored.revision_number || 1),
    requestType: stored.request_type,
    canFollowUp: ready
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
  continueDesignRequest,
  generateAccessToken,
  generateRequestCode,
  getDesignRequestStatus,
  getPublicDesignGallery,
  normalizeDimension,
  normalizePhone,
  hashAccessToken,
  validateDesignFollowupPayload,
  validateDesignRequestPayload
};
