/* eslint-disable no-console */

import { mapEMCItemsToAI23CostosReferencia } from "../ai23/ai23.emc-adapter.js";
import { createAI23CostosReferenciaService } from "../ai23/index.js";
import { createSupabaseServerClient } from "./storage-engine.js";
import { normalizeEmcPriceToUsd } from "./emc-price-normalizer.js";

const EMC_DEFAULT_CATEGORIA_ID = "58f1e60a-73ab-4399-83cc-c1c49322ab75";
const EMC_DEFAULT_TIPO_ITEM_ID = "be6bde34-caa3-43d7-8253-f5e66637daa7";
const EMC_DEFAULT_UNIDAD_BASE_ID = "157c091d-f8d5-4552-822d-dc55066c5ac1";

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

function normalizeMoneda(value) {
  const raw = safeText(value, null);
  if (!raw) return null;

  const text = raw.toUpperCase();

  if (["C$", "NIO", "CORDOBA", "CORDOBAS", "CÃ“RDOBA", "CÃ“RDOBAS"].includes(text)) return "NIO";
  if (["USD", "US$", "U$", "$", "DOLAR", "DOLARES", "DÃ“LAR", "DÃ“LARES"].includes(text)) return "USD";

  return ["NIO", "USD"].includes(text) ? text : null;
}

function detectarMonedaItems(items = []) {
  const encontrada = items
    .map((item) => normalizeMoneda(item.moneda || item.currency || item.divisa))
    .find(Boolean);

  return encontrada || null;
}

function normalizarItemsUsd(items = []) {
  return items.map((item) => {
    const normalizado = normalizeEmcPriceToUsd({
      precio: item.precio,
      moneda: item.moneda,
      incluye_iva: item.incluye_iva ?? true,
      iva_porcentaje: item.iva_porcentaje ?? 15,
      tipo_cambio: item.tipo_cambio,
    });

    if (!normalizado.ok) {
      return {
        ...item,
        precio_normalizacion_error: normalizado.error,
      };
    }

    return {
      ...item,

      precio_origen: normalizado.precio_origen,
      moneda_origen: normalizado.moneda_origen,

      precio_base_origen: normalizado.precio_base_origen,
      iva_origen: normalizado.iva_origen,
      precio_total_origen: normalizado.precio_total_origen,

      precio_usd_base: normalizado.precio_usd_base,
      precio_usd_iva: normalizado.precio_usd_iva,
      precio_usd_total: normalizado.precio_usd_total,

      precio: normalizado.precio_usd_total,
      moneda: "USD",

      tipo_cambio_usado: normalizado.tipo_cambio_usado,
      incluye_iva: normalizado.incluye_iva,
      iva_porcentaje: normalizado.iva_porcentaje,

      observaciones: [
        item.observaciones || item.linea_original || "",
        `ORIGEN: ${normalizado.moneda_origen} ${normalizado.precio_origen}`,
        `USD: ${normalizado.precio_usd_total}`,
        `TC: ${normalizado.tipo_cambio_usado}`,
      ].filter(Boolean).join(" | "),
    };
  });
}

function buildListaNombre({ proveedor, archivo }) {
  const proveedorNombre = safeText(proveedor.nombre || proveedor.name, "Proveedor EMC");
  const archivoNombre = safeText(archivo?.name || archivo?.nombre, "");
  return archivoNombre ? `${proveedorNombre} - ${archivoNombre}` : `${proveedorNombre} - Lista EMC`;
}

async function obtenerOCrearListaPrecio({ supabase, proveedor, archivo, items }) {
  const proveedorId = proveedor.id;
  const moneda = detectarMonedaItems(items);

  if (!moneda) {
    return {
      ok: false,
      error: "No se detectÃ³ moneda en la importaciÃ³n EMC.",
    };
  }

  const nombreLista = buildListaNombre({ proveedor, archivo });

  const { data: existente, error: errorBuscar } = await supabase
    .from("elankav_catalogo_listas_precio")
    .select("id, moneda")
    .eq("proveedor_id", proveedorId)
    .eq("nombre", nombreLista)
    .maybeSingle();

  if (errorBuscar) {
    return {
      ok: false,
      error: errorBuscar.message,
    };
  }

  if (existente?.id) {
    return {
      ok: true,
      lista_precio_id: existente.id,
      moneda: existente.moneda || moneda,
    };
  }

  const payload = {
    proveedor_id: proveedorId,
    nombre: nombreLista,
    version: "AI-22",
    fecha_lista: new Date().toISOString().slice(0, 10),
    fecha_inicio: new Date().toISOString().slice(0, 10),
    moneda: "USD",
    incluye_iva_default: true,
    iva_porcentaje_default: 15,
    estado: "ACTIVA",
    fuente: "AI-22-EMC",
    observaciones: safeText(archivo?.name || archivo?.nombre, "Lista creada automÃ¡ticamente por AI-22 EMC"),
    activa: true,
  };

  const { data, error } = await supabase
    .from("elankav_catalogo_listas_precio")
    .insert(payload)
    .select("id, moneda")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    lista_precio_id: data.id,
    moneda: data.moneda || moneda,
  };
}

async function obtenerOCrearItemCatalogo({ supabase, item, pagina, index }) {
  const nombre = safeText(
    item.nombre || item.descripcion,
    `Producto EMC ${pagina}-${index + 1}`
  );

  const codigo =
    safeText(item.codigo) ||
    `EMC-${nombre.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 40)}`;

  const { data: existente, error: errorBuscar } = await supabase
    .from("elankav_catalogo_items")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();

  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente?.id) return existente.id;

  const payload = {
    codigo,
    nombre,
    categoria_id: EMC_DEFAULT_CATEGORIA_ID,
    tipo_item_id: EMC_DEFAULT_TIPO_ITEM_ID,
    unidad_base_id: EMC_DEFAULT_UNIDAD_BASE_ID,
    descripcion: safeText(item.descripcion || item.linea_original),
    medida_texto: safeText(item.presentacion || item.unidad),
    unidad_calculo: "UNIDAD",
    uso: "COMPRA",
    estado: "ACTIVO",
    activo: true,
  };

  const { data, error } = await supabase
    .from("elankav_catalogo_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

function buildItemPayload({ proveedor, item, archivo, pagina, index, listaPrecioId }) {
  return {
    lista_precio_id: listaPrecioId,
    proveedor_id: proveedor.id,
        item_id: item.item_id,
    codigo_catalogo: safeText(item.codigo),
    nombre_catalogo: safeText(item.nombre || item.descripcion, `Producto EMC ${pagina}-${index + 1}`),
    presentacion: safeText(item.presentacion || item.unidad),
    marca_id: null,
    unidad_compra_id: null,
    precio_lista: safeNumber(item.precio_usd_total ?? item.precio),
    incluye_iva: true,
    iva_porcentaje: 15,
    precio_confirmado: false,
estado_informacion: "COMPLETO",
    usar_presupuesto: false,
    prioridad_compra: 1,
    activo: true,
    observaciones: safeText(item.observaciones || item.linea_original),
  };
}

async function insertWithFallback({ supabase, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: true,
      table: "elankav_catalogo_proveedor_items",
      data: [],
    };
  }

  for (const row of rows) {
    await supabase
      .from("elankav_catalogo_proveedor_items")
      .delete()
      .eq("proveedor_id", row.proveedor_id)
      .eq("lista_precio_id", row.lista_precio_id)
      .eq("nombre_catalogo", row.nombre_catalogo)
      .eq("presentacion", row.presentacion);
  }

  const { data, error } = await supabase
    .from("elankav_catalogo_proveedor_items")
    .insert(rows)
    .select();

  if (!error) {
    return {
      ok: true,
      table: "elankav_catalogo_proveedor_items",
      data: data || [],
    };
  }

  return {
    ok: false,
    error: error.message || "No se pudo guardar EMC.",
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

  items = normalizarItemsUsd(items);

  const supabase = createSupabaseServerClient();

  const lista = await obtenerOCrearListaPrecio({
    supabase,
    proveedor,
    archivo,
    items,
  });

  if (!lista.ok || !lista.lista_precio_id) {
    return {
      ok: false,
      guardado: false,
      pagina,
      total: items.length,
      error: lista.error || "No se pudo crear lista de precios EMC.",
    };
  }

    const rows = [];

  for (const [index, item] of items.entries()) {
    const itemId = await obtenerOCrearItemCatalogo({
      supabase,
      item,
      pagina,
      index,
    });

    rows.push(
      buildItemPayload({
        proveedor,
        item: {
          ...item,
          item_id: itemId,
        },
        archivo,
        pagina,
        index,
        listaPrecioId: lista.lista_precio_id,
      })
    );
  }

  const result = await insertWithFallback({ supabase, rows });

  try {
    const ai23 = createAI23CostosReferenciaService();

    const costos = mapEMCItemsToAI23CostosReferencia(
      items.map((item) => ({
        ...item,
        moneda: item.moneda || lista.moneda: "USD",
      }))
    );

    if (costos.length > 0) {
      await ai23.crearMasivo?.(costos) || Promise.all(costos.map((c) => ai23.crear(c)));
    }
  } catch (e) {
    console.warn("AI23 sync fallback:", e.message);
  }

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
    lista_precio_id: lista.lista_precio_id,
    moneda: lista.moneda,
    ids: result.data.map((row) => row.id).filter(Boolean),
  };
}

export default {
  savePageItems,
};
