/* eslint-disable no-console */

import { createSupabaseServerClient } from "./storage-engine.js";

function safeText(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function buildItemPayload({ proveedor, item, archivo, pagina, index }) {
  return {
    proveedor_id: proveedor.id,
    proveedor_nombre: safeText(proveedor.nombre || proveedor.name, "Proveedor EMC"),
    codigo_proveedor: safeText(item.codigo),
    nombre: safeText(item.nombre || item.descripcion, `Producto EMC ${pagina}-${index + 1}`),
    descripcion: safeText(item.descripcion || item.nombre),
    marca: safeText(item.marca),
    categoria: safeText(item.categoria),
    subcategoria: safeText(item.subcategoria),
    unidad: safeText(item.unidad),
    moneda: safeText(item.moneda),
    precio: safeNumber(item.precio),
    fuente: "AI-22-EMC",
    archivo_nombre: safeText(archivo?.name || archivo?.nombre),
    archivo_path: safeText(archivo?.path || archivo?.storage_path),
    pagina,
    estado: "activo",
    metadata: {
      ai_version: "AI-22",
      engine: item.fuente || "unknown",
      linea_original: item.linea_original || null,
      imported_at: nowIso(),
    },
  };
}

async function insertWithFallback({ supabase, rows }) {
  const attempts = [
    {
      table: "elankav_catalogo_proveedor_items",
      rows,
    },
    {
      table: "emc_import_items",
      rows,
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const { data, error } = await supabase.from(attempt.table).insert(attempt.rows).select();

    if (!error) {
      return {
        ok: true,
        table: attempt.table,
        data: data || [],
      };
    }

    lastError = error;
  }

  return {
    ok: false,
    error: lastError?.message || "No se pudo guardar EMC.",
  };
}

export async function savePageItems({ proveedor, items = [], archivo = {}, pagina = 1 } = {}) {
  if (!proveedor?.id) {
    return {
      ok: false,
      guardado: false,
      error: "Falta proveedor.id para guardar EMC.",
    };
  }

  if (!Array.isArray(items) || !items.length) {
    return {
      ok: true,
      guardado: false,
      razon: "sin_items",
      pagina,
      total: 0,
    };
  }

  const supabase = createSupabaseServerClient();

  const rows = items.map((item, index) =>
    buildItemPayload({
      proveedor,
      item,
      archivo,
      pagina,
      index,
    })
  );

  const result = await insertWithFallback({ supabase, rows });

  if (!result.ok) {
    return {
      ok: false,
      guardado: false,
      pagina,
      total: items.length,
      error: result.error,
    };
  }

  return {
    ok: true,
    guardado: true,
    pagina,
    total: items.length,
    table: result.table,
    ids: result.data.map((row) => row.id).filter(Boolean),
  };
}

export default {
  savePageItems,
};