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
  decodeDataUrl,
  insertDesignRequest,
  listPublishedDesigns,
  resolveDesignSupabaseConfig,
  sanitizeFileName,
  uploadDesignAsset
};
