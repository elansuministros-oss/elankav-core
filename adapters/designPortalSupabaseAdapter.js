const DESIGN_REQUESTS_TABLE = 'design_requests';
const DESIGN_GALLERY_TABLE = 'design_gallery_items';
const DESIGN_ASSETS_BUCKET = 'design-request-assets';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function resolveDesignSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    const error = new Error('Design Portal Supabase no configurado');
    error.code = 'DESIGN_SUPABASE_NOT_CONFIGURED';
    throw error;
  }

  return { url, key };
}

function createDesignHeaders(key, extra = {}) {
  const headers = { apikey: key, ...extra };

  if (key.split('.').length === 3) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

function sanitizeFileName(value) {
  const safe = String(value || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return safe || 'archivo';
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(
    /^data:(image\/png|image\/jpeg|image\/webp|image\/svg\+xml|application\/pdf);base64,([a-z0-9+/=\r\n]+)$/i
  );

  if (!match) {
    const error = new Error('Archivo de diseño inválido');
    error.code = 'DESIGN_FILE_INVALID';
    throw error;
  }

  const bytes = Buffer.from(match[2], 'base64');

  if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
    const error = new Error('Archivo de diseño excede el límite permitido');
    error.code = 'DESIGN_FILE_SIZE_INVALID';
    throw error;
  }

  return { mimeType: match[1].toLowerCase(), bytes };
}

async function uploadDesignAsset({
  requestCode,
  kind,
  file,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const decoded = decodeDataUrl(file?.dataUrl);
  const fileName = sanitizeFileName(file?.name);
  const path = `${requestCode}/${kind}-${crypto.randomUUID()}-${fileName}`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetchImpl(
    `${url}/storage/v1/object/${DESIGN_ASSETS_BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: createDesignHeaders(key, {
        'Content-Type': decoded.mimeType,
        'x-upsert': 'false'
      }),
      body: decoded.bytes
    }
  );

  if (!response.ok) {
    const error = new Error('No fue posible guardar el archivo de diseño');
    error.code = 'DESIGN_FILE_UPLOAD_FAILED';
    throw error;
  }

  return Object.freeze({
    kind,
    name: fileName,
    mimeType: decoded.mimeType,
    sizeBytes: decoded.bytes.length,
    bucket: DESIGN_ASSETS_BUCKET,
    path
  });
}

async function insertDesignRequest(row, { fetchImpl = globalThis.fetch } = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const response = await fetchImpl(
    `${url}/rest/v1/${DESIGN_REQUESTS_TABLE}`,
    {
      method: 'POST',
      headers: createDesignHeaders(key, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(row)
    }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data) || !data[0]) {
    const error = new Error('No fue posible registrar la solicitud de diseño');
    error.code = 'DESIGN_REQUEST_INSERT_FAILED';
    throw error;
  }

  return data[0];
}

async function findDesignRequestByAccess({
  requestCode,
  accessTokenHash,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const query = new URLSearchParams({
    select: 'id,request_code,whatsapp,status,request_type,installation_environment,width_cm,height_cm,has_logo,needs_logo_design,design_notes,files,result_files,design_result,completed_at,last_error_code,delivery_status,delivery_attempts,delivery_started_at,delivered_at,workflow_stage,revision_number,version_history',
    request_code: `eq.${requestCode}`,
    access_token_hash: `eq.${accessTokenHash}`,
    limit: '1'
  });
  const response = await fetchImpl(
    `${url}/rest/v1/${DESIGN_REQUESTS_TABLE}?${query}`,
    { headers: createDesignHeaders(key) }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    const error = new Error('No fue posible consultar la solicitud de diseño');
    error.code = 'DESIGN_REQUEST_READ_FAILED';
    throw error;
  }

  return data[0] || null;
}

async function updateDesignRequestByAccess({
  requestCode,
  accessTokenHash,
  values,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const query = new URLSearchParams({
    request_code: `eq.${requestCode}`,
    access_token_hash: `eq.${accessTokenHash}`,
    status: 'in.(review,approved,quoted,closed,failed)'
  });
  const response = await fetchImpl(
    `${url}/rest/v1/${DESIGN_REQUESTS_TABLE}?${query}`,
    {
      method: 'PATCH',
      headers: createDesignHeaders(key, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(values)
    }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    const error = new Error('No fue posible actualizar la solicitud de diseño');
    error.code = 'DESIGN_FOLLOWUP_UPDATE_FAILED';
    throw error;
  }

  return data[0] || null;
}

async function downloadDesignAsset({
  bucket,
  path,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const encodedPath = String(path || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const response = await fetchImpl(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
    { headers: createDesignHeaders(key) }
  );

  if (!response.ok) {
    const error = new Error('No fue posible leer el resultado de diseño');
    error.code = 'DESIGN_RESULT_DOWNLOAD_FAILED';
    throw error;
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
    const error = new Error('El resultado de diseño no es válido');
    error.code = 'DESIGN_RESULT_FILE_INVALID';
    throw error;
  }

  return Object.freeze({
    bytes,
    mimeType: String(response.headers.get('content-type') || 'image/png')
      .split(';')[0]
      .trim()
      .toLowerCase()
  });
}

async function patchDesignDelivery({
  id,
  filters = {},
  values,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const query = new URLSearchParams({ id: `eq.${id}`, ...filters });
  const response = await fetchImpl(
    `${url}/rest/v1/${DESIGN_REQUESTS_TABLE}?${query}`,
    {
      method: 'PATCH',
      headers: createDesignHeaders(key, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify(values)
    }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    const error = new Error('No fue posible actualizar la entrega del diseño');
    error.code = 'DESIGN_DELIVERY_UPDATE_FAILED';
    throw error;
  }

  return data[0] || null;
}

async function claimDesignDelivery({
  id,
  attempts = 0,
  fetchImpl = globalThis.fetch
} = {}) {
  return patchDesignDelivery({
    id,
    filters: { delivery_status: 'in.(pending,failed)' },
    values: {
      delivery_status: 'sending',
      delivery_attempts: Number(attempts || 0) + 1,
      delivery_started_at: new Date().toISOString(),
      delivery_error_code: null
    },
    fetchImpl
  });
}

async function recoverStaleDesignDelivery({
  id,
  startedAt,
  now = Date.now(),
  fetchImpl = globalThis.fetch
} = {}) {
  const started = Date.parse(String(startedAt || ''));

  if (!Number.isFinite(started) || now - started < 120_000) return null;

  return patchDesignDelivery({
    id,
    filters: { delivery_status: 'eq.sending' },
    values: {
      delivery_status: 'failed',
      delivery_error_code: 'DESIGN_DELIVERY_INTERRUPTED'
    },
    fetchImpl
  });
}

async function markDesignDelivery({
  id,
  delivered,
  errorCode = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return patchDesignDelivery({
    id,
    filters: { delivery_status: 'eq.sending' },
    values: delivered
      ? {
          delivery_status: 'delivered',
          delivery_error_code: null,
          delivered_at: new Date().toISOString()
        }
      : {
          delivery_status: 'failed',
          delivery_error_code: String(errorCode || 'DESIGN_DELIVERY_FAILED').slice(0, 120)
        },
    fetchImpl
  });
}

async function createSignedDesignAssetUrl({
  bucket,
  path,
  expiresIn = 3600,
  fetchImpl = globalThis.fetch
} = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const encodedPath = String(path || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const response = await fetchImpl(
    `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: createDesignHeaders(key, {
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ expiresIn })
    }
  );
  const data = await response.json().catch(() => null);
  const signedPath = data?.signedURL || data?.signedUrl || data?.signed_url;

  if (!response.ok || !signedPath) {
    const error = new Error('No fue posible preparar el resultado de diseño');
    error.code = 'DESIGN_RESULT_SIGN_FAILED';
    throw error;
  }

  return String(signedPath).startsWith('http')
    ? String(signedPath)
    : `${url}/storage/v1${signedPath}`;
}

async function listPublishedDesigns({ fetchImpl = globalThis.fetch } = {}) {
  const { url, key } = resolveDesignSupabaseConfig();
  const query = new URLSearchParams({
    select: 'id,title,category,description,image_url,thumbnail_url,published_at',
    status: 'eq.published',
    order: 'sort_order.asc,published_at.desc',
    limit: '60'
  });
  const response = await fetchImpl(
    `${url}/rest/v1/${DESIGN_GALLERY_TABLE}?${query}`,
    { headers: createDesignHeaders(key) }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    const error = new Error('No fue posible consultar la galería de diseños');
    error.code = 'DESIGN_GALLERY_READ_FAILED';
    throw error;
  }

  return data;
}

export {
  DESIGN_ASSETS_BUCKET,
  DESIGN_GALLERY_TABLE,
  DESIGN_REQUESTS_TABLE,
  MAX_FILE_BYTES,
  createDesignHeaders,
  claimDesignDelivery,
  decodeDataUrl,
  createSignedDesignAssetUrl,
  downloadDesignAsset,
  findDesignRequestByAccess,
  insertDesignRequest,
  listPublishedDesigns,
  markDesignDelivery,
  recoverStaleDesignDelivery,
  resolveDesignSupabaseConfig,
  sanitizeFileName,
  updateDesignRequestByAccess,
  uploadDesignAsset
};
