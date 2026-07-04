/* eslint-disable no-console */

const DEFAULT_TIPO_CAMBIO_USD_NIO = Number(process.env.TIPO_CAMBIO_USD_NIO || 36.6243);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMoneda(value) {
  const text = String(value || "").trim().toUpperCase();

  if (["C$", "NIO", "CORDOBA", "CORDOBAS", "CÓRDOBA", "CÓRDOBAS"].includes(text)) return "NIO";
  if (["USD", "US$", "U$", "$", "DOLAR", "DOLARES", "DÓLAR", "DÓLARES"].includes(text)) return "USD";

  return text === "NIO" || text === "USD" ? text : null;
}

export function normalizeEmcPriceToUsd({
  precio,
  moneda,
  incluye_iva = true,
  iva_porcentaje = 15,
  tipo_cambio = DEFAULT_TIPO_CAMBIO_USD_NIO,
} = {}) {
  const precioOrigen = safeNumber(precio, 0);
  const monedaOrigen = normalizeMoneda(moneda);
  const ivaRate = safeNumber(iva_porcentaje, 15) / 100;
  const tc = safeNumber(tipo_cambio, DEFAULT_TIPO_CAMBIO_USD_NIO);

  if (!precioOrigen || !monedaOrigen) {
    return {
      ok: false,
      error: "PRECIO_O_MONEDA_INVALIDA",
    };
  }

  if (!tc || tc <= 0) {
    return {
      ok: false,
      error: "TIPO_CAMBIO_INVALIDO",
    };
  }

  const precioTotalOrigen = incluye_iva ? precioOrigen : precioOrigen * (1 + ivaRate);
  const precioBaseOrigen = incluye_iva ? precioOrigen / (1 + ivaRate) : precioOrigen;
  const ivaOrigen = precioTotalOrigen - precioBaseOrigen;

  const divisor = monedaOrigen === "NIO" ? tc : 1;

  return {
    ok: true,

    precio_origen: precioOrigen,
    moneda_origen: monedaOrigen,

    incluye_iva,
    iva_porcentaje: safeNumber(iva_porcentaje, 15),

    precio_base_origen: Number(precioBaseOrigen.toFixed(4)),
    iva_origen: Number(ivaOrigen.toFixed(4)),
    precio_total_origen: Number(precioTotalOrigen.toFixed(4)),

    precio_usd_base: Number((precioBaseOrigen / divisor).toFixed(4)),
    precio_usd_iva: Number((ivaOrigen / divisor).toFixed(4)),
    precio_usd_total: Number((precioTotalOrigen / divisor).toFixed(4)),

    moneda_operativa: "USD",
    tipo_cambio_usado: monedaOrigen === "NIO" ? tc : 1,
  };
}
