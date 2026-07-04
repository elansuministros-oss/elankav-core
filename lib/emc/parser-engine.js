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

  let cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/[.,]+$/g, "");

  if (!cleaned) return null;

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function detectCurrency(line = "") {
  const text = String(line || "").toUpperCase();

  if (text.includes("C$") || text.includes("CORDOBA") || text.includes("CÓRDOBA") || text.includes("CÃ“RDOBA")) return "NIO";
  if (text.includes("$") || text.includes("USD") || text.includes("DOLAR") || text.includes("DÓLAR") || text.includes("DÃ“LAR")) return "USD";

  return null;
}

function looksLikeProductLine(line = "") {
  const text = String(line || "").trim();

  if (text.length < 4) return false;

  const hasLetters = /[a-záéíóúñÃ]/i.test(text);
  const hasTerminalPrice = /(?:C\$|\$|USD|U\$)?\s*\d{1,3}(?:[,.]\d{3})+(?:[,.]\d{1,2})?\.?\s*$/i.test(text)
    || /(?:C\$|\$|USD|U\$)\s*\d+(?:[.,]\d+)?\.?\s*$/i.test(text);

  const banned =
    /^(total|subtotal|iva|retenci[oóÃ³]n|p[aáÃ¡]gina|fecha|cliente|proveedor|tel[eéÃ©]fono|direcci[oóÃ³]n)\b/i.test(text);

  return hasLetters && hasTerminalPrice && !banned;
}

function extractTerminalPrice(text = "") {
  const source = String(text || "").trim();

  const match = source.match(
    /(?:C\$|\$|USD|U\$)?\s*(\d{1,3}(?:[,.]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\.?\s*$/i
  );

  if (!match) {
    return { precio: null, descripcion: source };
  }

  return {
    precio: normalizeNumber(match[1]),
    descripcion: source.slice(0, match.index).trim(),
  };
}

function extractPresentation(descripcion = "") {
  const text = String(descripcion || "").trim();

  const match = text.match(
    /(\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|CM|MM|YD|YDS|YARDAS)?)(?!.*\d+(?:[.,]\d+)?\s*[xX]\s*\d+)/i
  );

  if (!match) {
    return {
      nombre: text,
      presentacion: null,
    };
  }

  const presentacion = match[1].replace(/\s+/g, "").toUpperCase();
  const nombre = text.replace(match[1], " ").replace(/\s{2,}/g, " ").trim();

  return {
    nombre,
    presentacion,
  };
}

function parseProductLine(line = "", context = {}) {
  const text = String(line || "").trim();
  const currency = detectCurrency(text) || context.moneda || null;

  const { precio, descripcion: descripcionSinPrecio } = extractTerminalPrice(text);

  let descripcion = descripcionSinPrecio
    .replace(/^[\-\*\•\d.\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!descripcion || descripcion.length < 3) return null;

  const extracted = extractPresentation(descripcion);
  descripcion = extracted.nombre || descripcion;

  const codeMatch = descripcion.match(/^([A-Z0-9][A-Z0-9\-_.\/]{2,})\s+(.+)$/);
  const codigo = codeMatch ? codeMatch[1].trim() : null;
  const nombre = codeMatch ? codeMatch[2].trim() : descripcion;

  return {
    codigo,
    nombre,
    descripcion: nombre,
    presentacion: extracted.presentacion,
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
      presentacion: item.presentacion || item.presentation || null,
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