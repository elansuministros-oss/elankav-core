/* eslint-disable no-console */

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeNumber(value) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function detectCurrency(line = "") {
  const text = String(line || "").toUpperCase();

  if (text.includes("C$") || text.includes("CORDOBA") || text.includes("CÓRDOBA")) return "NIO";
  if (text.includes("$") || text.includes("USD") || text.includes("DOLAR") || text.includes("DÓLAR")) return "USD";

  return null;
}

function looksLikeProductLine(line = "") {
  const text = String(line || "").trim();

  if (text.length < 4) return false;

  const hasPrice = /(?:C\$|\$|USD|U\$)?\s*\d+[.,]?\d*/i.test(text);
  const hasLetters = /[a-záéíóúñ]/i.test(text);
  const banned =
    /^(total|subtotal|iva|retenci[oó]n|p[aá]gina|fecha|cliente|proveedor|tel[eé]fono|direcci[oó]n)\b/i.test(text);

  return hasLetters && hasPrice && !banned;
}

function parseProductLine(line = "", context = {}) {
  const text = String(line || "").trim();
  const currency = detectCurrency(text) || context.moneda || null;

  const priceMatches = [...text.matchAll(/(?:C\$|\$|USD|U\$)?\s*(\d+(?:[.,]\d{1,4})?)/gi)];
  const lastPrice = priceMatches.length ? priceMatches[priceMatches.length - 1] : null;
  const precio = lastPrice ? normalizeNumber(lastPrice[1]) : null;

  let descripcion = text;

  if (lastPrice && lastPrice.index !== undefined) {
    descripcion = text.slice(0, lastPrice.index).trim();
  }

  descripcion = descripcion
    .replace(/^[\-\*\•\d.\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!descripcion || descripcion.length < 3) return null;

  const codeMatch = descripcion.match(/^([A-Z0-9][A-Z0-9\-_.\/]{2,})\s+(.+)$/);
  const codigo = codeMatch ? codeMatch[1].trim() : null;
  const nombre = codeMatch ? codeMatch[2].trim() : descripcion;

  return {
    codigo,
    nombre,
    descripcion,
    precio,
    moneda: currency,
    unidad: context.unidad || null,
    marca: context.marca || null,
    categoria: context.categoria || null,
    subcategoria: context.subcategoria || null,
    fuente: "parser-engine",
    linea_original: text,
  };
}

export function parseTextProducts({ text = "", context = {} } = {}) {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);

  const items = [];

  for (const line of lines) {
    if (!looksLikeProductLine(line)) continue;

    const item = parseProductLine(line, context);

    if (item) items.push(item);
  }

  return {
    ok: true,
    engine: "parser-engine",
    source: "text",
    total: items.length,
    items,
    meta: {
      chars: normalized.length,
      lines: lines.length,
    },
  };
}

export function parseVisionProducts({ visionResult = {}, context = {} } = {}) {
  const rawItems = Array.isArray(visionResult.items)
    ? visionResult.items
    : Array.isArray(visionResult.productos)
      ? visionResult.productos
      : [];

  const items = rawItems
    .map((item) => ({
      codigo: item.codigo || item.code || null,
      nombre: item.nombre || item.name || item.descripcion || "Producto sin nombre",
      descripcion: item.descripcion || item.description || item.nombre || item.name || "",
      precio: normalizeNumber(item.precio ?? item.price ?? item.costo ?? item.cost),
      moneda: item.moneda || item.currency || context.moneda || null,
      unidad: item.unidad || item.unit || context.unidad || null,
      marca: item.marca || item.brand || context.marca || null,
      categoria: item.categoria || item.category || context.categoria || null,
      subcategoria: item.subcategoria || item.subcategory || context.subcategoria || null,
      fuente: "vision-engine",
      linea_original: item.linea_original || item.raw || "",
    }))
    .filter((item) => String(item.nombre || "").trim());

  return {
    ok: true,
    engine: "parser-engine",
    source: "vision",
    total: items.length,
    items,
  };
}

export default {
  parseTextProducts,
  parseVisionProducts,
};