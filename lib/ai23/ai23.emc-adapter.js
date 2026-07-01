import { AI23_MONEDAS, AI23_ESTADOS } from "./ai23.constants.js";

function safeText(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeMoneda(value) {
  const moneda = safeText(value, AI23_MONEDAS.USD).toUpperCase();
  return Object.values(AI23_MONEDAS).includes(moneda) ? moneda : AI23_MONEDAS.USD;
}

export function mapEMCItemToAI23CostoReferencia(item = {}) {
  const costo = safeNumber(item.precio ?? item.costo ?? item.costo_unitario, null);

  if (!costo || costo <= 0) {
    return null;
  }

  return {
    codigo: safeText(item.codigo_proveedor ?? item.codigo),
    nombre: safeText(item.nombre || item.descripcion, "Costo referencia EMC"),
    descripcion: safeText(item.descripcion || item.nombre),
    categoria: safeText(item.categoria),
    unidad: safeText(item.unidad),
    moneda: normalizeMoneda(item.moneda),
    costo,
    proveedor_id: safeText(item.proveedor_id),
    item_origen_id: safeText(item.id),
    estado: AI23_ESTADOS.activo
  };
}

export function mapEMCItemsToAI23CostosReferencia(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => mapEMCItemToAI23CostoReferencia(item))
    .filter(Boolean);
}
