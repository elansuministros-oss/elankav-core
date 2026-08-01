const COMMERCIAL_PRODUCTS_TABLE = 'commercial_products';
const COMMERCIAL_PRODUCTS_BASE_COLUMNS = [
  'product_id',
  'platform_id',
  'version',
  'status',
  'name',
  'description',
  'aliases',
  'specifications',
  'price_offers',
  'sales_guidance',
  'commercial_rules'
];
const COMMERCIAL_PRODUCTS_EXTENDED_COLUMNS = [
  ...COMMERCIAL_PRODUCTS_BASE_COLUMNS,
  'category',
  'subcategory',
  'formula_type',
  'currency',
  'base_price',
  'base_width',
  'base_height',
  'base_area_m2',
  'price_per_m2',
  'price_per_linear_meter',
  'unit_price',
  'minimum_price',
  'fixed_cost',
  'variable_cost',
  'includes',
  'exclusions',
  'commercial_guidance',
  'source_catalog_id',
  'source_document',
  'approved',
  'effective_from',
  'effective_to',
  'contract_version',
  'publication_status'
];

function resolveCommercialSupabaseConfig() {
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
    const error = new Error('Commercial Supabase no configurado');
    error.code = 'COMMERCIAL_SUPABASE_NOT_CONFIGURED';
    throw error;
  }

  return { url, key };
}

function createHeaders(key) {
  const headers = { apikey: key };

  if (key.split('.').length === 3) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

async function fetchCommercialProducts({ url, key, fetchImpl, columns }) {
  const query = new URLSearchParams({
    select: columns.join(','),
    status: 'eq.active',
    order: 'product_id.asc'
  });

  const response = await fetchImpl(
    `${url}/rest/v1/${COMMERCIAL_PRODUCTS_TABLE}?${query}`,
    { headers: createHeaders(key) }
  );
  const data = await response.json().catch(() => null);

  return { response, data };
}

function isMissingExtendedColumn(data) {
  return data?.code === '42703' &&
    /column commercial_products\.[a-z_]+ does not exist/i.test(String(data?.message || ''));
}

async function listCommercialProducts({
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') {
    const error = new Error('Cliente HTTP comercial no disponible');
    error.code = 'COMMERCIAL_SUPABASE_CLIENT_UNAVAILABLE';
    throw error;
  }

  const { url, key } = resolveCommercialSupabaseConfig();
  let result;

  try {
    result = await fetchCommercialProducts({
      url,
      key,
      fetchImpl,
      columns: COMMERCIAL_PRODUCTS_EXTENDED_COLUMNS
    });
    if (!result.response.ok && isMissingExtendedColumn(result.data)) {
      result = await fetchCommercialProducts({
        url,
        key,
        fetchImpl,
        columns: COMMERCIAL_PRODUCTS_BASE_COLUMNS
      });
    }
  } catch (cause) {
    const error = new Error('Commercial Supabase no disponible');
    error.code = 'COMMERCIAL_SUPABASE_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }

  if (!result.response.ok || !Array.isArray(result.data)) {
    const error = new Error('Commercial Supabase devolvio una respuesta invalida');
    error.code = 'COMMERCIAL_SUPABASE_RESPONSE_INVALID';
    throw error;
  }

  return result.data;
}

export {
  COMMERCIAL_PRODUCTS_BASE_COLUMNS,
  COMMERCIAL_PRODUCTS_EXTENDED_COLUMNS,
  COMMERCIAL_PRODUCTS_TABLE,
  createHeaders,
  listCommercialProducts,
  resolveCommercialSupabaseConfig
};
