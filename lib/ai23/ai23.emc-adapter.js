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
  const raw = safeText(value, null);
  if (!raw) return null;

  const moneda = raw.toUpperCase();

  if (["C$", "NIO", "CORDOBA", "CORDOBAS", "CÓRDOBA", "CÓRDOBAS"].includes(moneda)) {
    return AI23_MONEDAS.NIO;
  }

  if (["USD", "US$", "U$", "DOLAR", "DOLARES", "DÓLAR", "DÓLARES"].includes(moneda)) {
    return AI23_MONEDAS.USD;
  }

  return Object.values(AI23_MONEDAS).includes(moneda) ? moneda : null;
}

export function mapEMCItemToAI23CostoReferencia(item = {}) {
  const costo = safeNumber(item.precio ?? item.costo ?? item.costo_unitario, null);
  const moneda = normalizeMoneda(item.moneda);

  if (!costo || costo <= 0) {
    return null;
  }

  if (!moneda) {
    return null;
  }

  return {
    codigo: safeText(item.codigo_proveedor ?? item.codigo),
    nombre: safeText(item.nombre || item.descripcion, "Costo referencia EMC"),
    descripcion: safeText(item.descripcion || item.nombre),
    categoria: safeText(item.categoria),
    unidad: safeText(item.unidad),
    moneda,
    costo,
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