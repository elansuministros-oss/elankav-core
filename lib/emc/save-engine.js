/* eslint-disable no-console */

import { mapEMCItemsToAI23CostosReferencia } from "../ai23/ai23.emc-adapter.js";
import { createAI23CostosReferenciaService } from "../ai23/index.js";
import { createSupabaseServerClient } from "./storage-engine.js";

const EMC_DEFAULT_CATEGORIA_ID = "58f1e60a-73ab-4399-83cc-c1c49322ab75";
const EMC_DEFAULT_TIPO_ITEM_ID = "be6bde34-caa3-43d7-8253-f5e66637daa7";
const EMC_DEFAULT_UNIDAD_BASE_ID = "157c091d-f8d5-4552-822d-dc55066c5ac1";
const DEFAULT_TIPO_CAMBIO = Number(process.env.TIPO_CAMBIO_USD_NIO || 36.6243);

function safeText(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMoneda(value) {
  const raw = safeText(value, null);
  if (!raw) return null;
  const text = raw.toUpperCase();

  if (["C$", "NIO", "CORDOBA", "CORDOBAS", "CÓRDOBA", "CÓRDOBAS"].includes(text)) return "NIO";
  if (["USD", "US$", "U$", "$", "DOLAR", "DOLARES", "DÓLAR", "DÓLARES"].includes(text)) return "USD";

  return ["NIO", "USD"].includes(text) ? text : null;
}

function convertirItemAUsd(item) {
  const monedaOrigen = normalizeMoneda(item.moneda || item.currency || item.divisa) || "USD";
  const precioOrigen = safeNumber(item.precio, 0);
  const tipoCambio = safeNumber(item.tipo_cambio || DEFAULT_TIPO_CAMBIO, DEFAULT_TIPO_CAMBIO);

  const precioUsd = monedaOrigen === "NIO"
    ? precioOrigen / tipoCambio
    : precioOrigen;

  return {
    ...item,
    precio_origen: precioOrigen,
    moneda_origen: monedaOrigen,
    tipo_cambio_usado: monedaOrigen === "NIO" ? tipoCambio : 1,
    precio: Number(precioUsd.toFixed(4)),
    moneda: "USD",
    observaciones: [
      item.observaciones || item.linea_original || "",
      `ORIGEN ${monedaOrigen} ${precioOrigen}`,
      `USD ${Number(precioUsd.toFixed(4))}`,
      `TC ${monedaOrigen === "NIO" ? tipoCambio : 1}`,
    ].filter(Boolean).join(" | "),
  };
}

function buildListaNombre({ proveedor, archivo }) {
  const proveedorNombre = safeText(proveedor.nombre || proveedor.name, "Proveedor EMC");
  const archivoNombre = safeText(archivo?.name || archivo?.nombre, "");
  return archivoNombre ? `${proveedorNombre} - ${archivoNombre}` : `${proveedorNombre} - Lista EMC`;
}

async function obtenerOCrearListaPrecio({ supabase, proveedor, archivo }) {
  const proveedorId = proveedor.id;
  const nombreLista = buildListaNombre({ proveedor, archivo });

  const { data: existente, error: errorBuscar } = await supabase
    .from("elankav_catalogo_listas_precio")
    .select("id, moneda")
    .eq("proveedor_id", proveedorId)
    .eq("nombre", nombreLista)
    .maybeSingle();

  if (errorBuscar) return { ok: false, error: errorBuscar.message };

  if (existente?.id) {
    return { ok: true, lista_precio_id: existente.id, moneda: "USD" };
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
    observaciones: safeText(archivo?.name || archivo?.nombre, "Lista creada automáticamente por AI-22 EMC"),
    activa: true,
  };

  const { data, error } = await supabase
    .from("elankav_catalogo_listas_precio")
    .insert(payload)
    .select("id, moneda")
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, lista_precio_id: data.id, moneda: "USD" };
}

async function obtenerOCrearItemCatalogo({ supabase, item, pagina, index }) {
  const nombre = safeText(item.nombre || item.descripcion, `Producto EMC ${pagina}-${index + 1}`);
  const codigo = safeText(item.codigo) || `EMC-${nombre.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 40)}`;

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

function buildItemPayload({ proveedor, item, pagina, index, listaPrecioId }) {
  return {
    lista_precio_id: listaPrecioId,
    proveedor_id: proveedor.id,
    item_id: item.item_id,
    codigo_catalogo: safeText(item.codigo),
    nombre_catalogo: safeText(item.nombre || item.descripcion, `Producto EMC ${pagina}-${index + 1}`),
    presentacion: safeText(item.presentacion || item.unidad),
    marca_id: null,
    unidad_compra_id: null,
    precio_lista: safeNumber(item.precio), precio_origen: safeNumber(item.precio_origen), moneda_origen: safeText(item.moneda_origen), tipo_cambio_usado: safeNumber(item.tipo_cambio_usado), precio_usd_calculado: safeNumber(item.precio),
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

  if (error) return { ok: false, error: error.message || "No se pudo guardar EMC." };

  return { ok: true, table: "elankav_catalogo_proveedor_items", data: data || [] };
}

export async function savePageItems({ proveedor, items = [], archivo = {}, pagina = 1 } = {}) {
  if (!proveedor?.id) {
    return { ok: false, guardado: false, error: "Falta proveedor.id para guardar EMC." };
  }

  if (!Array.isArray(items) || !items.length) {
    return { ok: true, guardado: false, razon: "sin_items", pagina, total: 0 };
  }

  items = items.map(convertirItemAUsd);

  const supabase = createSupabaseServerClient();

  const lista = await obtenerOCrearListaPrecio({ supabase, proveedor, archivo });

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
    const itemId = await obtenerOCrearItemCatalogo({ supabase, item, pagina, index });

    rows.push(
      buildItemPayload({
        proveedor,
        item: { ...item, item_id: itemId },
        pagina,
        index,
        listaPrecioId: lista.lista_precio_id,
      })
    );
  }

  const result = await insertWithFallback({ supabase, rows });

  try {
    const ai23 = createAI23CostosReferenciaService();
    const costos = mapEMCItemsToAI23CostosReferencia(items);

    if (costos.length > 0) {
      await ai23.crearMasivo?.(costos) || Promise.all(costos.map((c) => ai23.crear(c)));
    }
  } catch (e) {
    console.warn("AI23 sync fallback:", e.message);
  }

  if (!result.ok) {
    return { ok: false, guardado: false, pagina, total: items.length, error: result.error };
  }

  return {
    ok: true,
    guardado: true,
    pagina,
    total: items.length,
    table: result.table,
    lista_precio_id: lista.lista_precio_id,
    moneda: "USD",
    ids: result.data.map((row) => row.id).filter(Boolean),
  };
}

export default { savePageItems };
