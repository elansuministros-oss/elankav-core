/* eslint-disable no-console */

function cleanText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(value = "") {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value) {
  let text = String(value ?? "").trim();
  if (!text) return null;

  text = text
    .replace(/[^\d.,-]/g, "")
    .replace(/[.,]+$/g, "");

  if (!text) return null;

  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(text)) {
    text = text.replace(",", ".");
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(line = "", context = {}) {
  const text = String(line || "").toUpperCase();

  if (text.includes("C$") || text.includes("NIO") || text.includes("CORDOBA") || text.includes("CÓRDOBA")) return "NIO";
  if (text.includes("USD") || text.includes("US$") || text.includes("U$")) return "USD";

  return context.moneda || context.currency || null;
}

function isRejectedLine(line = "") {
  return /^(total|subtotal|iva|retenci[oó]n|p[aá]gina|fecha|cliente|proveedor|tel[eé]fono|direcci[oó]n|cat[aá]logo|lista de precios)\b/i.test(line);
}

function findTerminalPrice(line = "") {
  const text = cleanLine(line);

  const patterns = [
    /(?:C\$|US\$|U\$|USD)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\.?\s*$/i,
    /(?:C\$|US\$|U\$|USD)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)\.?\s*$/i,
    /(?:C\$|US\$|U\$|USD)\s*(\d+(?:[.,]\d{1,2})?)\.?\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      return {
        raw: match[1],
        value: normalizeNumber(match[1]),
        start: match.index,
        end: match.index + match[0].length,
      };
    }
  }

  return null;
}

function extractPresentation(text = "") {
  const source = cleanLine(text);

  const patterns = [
    /(\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM|YD|YDS|YARDAS)?)/i,
    /(\d+\/\d+\s*[xX]\s*\d+\s*(?:YD|YDS|YARDAS|M|CM|MM)?)/i,
  ];

  let last = null;

  for (const pattern of patterns) {
    const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
    if (matches.length) last = matches[matches.length - 1];
  }

  if (!last || last.index === undefined) {
    return {
      nombre: source,
      presentacion: null,
    };
  }

  const presentacion = last[1].replace(/\s+/g, "").toUpperCase();
  const nombre = `${source.slice(0, last.index)} ${source.slice(last.index + last[0].length)}`
    .replace(/\s{2,}/g, " ")
    .trim();

  return { nombre, presentacion };
}

function splitCodeName(text = "") {
  const source = cleanLine(text);

  const match = source.match(/^([A-Z0-9][A-Z0-9._/-]{2,})\s+(.+)$/i);

  if (!match) {
    return {
      codigo: null,
      nombre: source,
    };
  }

  const code = match[1].trim();
  const name = match[2].trim();

  if (/^(LONA|VINIL|PVC|ACRILICO|ACRÍLICO|LAMINA|LÁMINA|MICROPERFORADO|PROMOPLUS|BACKLIT|MAGNETICO|MAGNÉTICO)$/i.test(code)) {
    return {
      codigo: code.toUpperCase(),
      nombre: name,
    };
  }

  return {
    codigo: code,
    nombre: name,
  };
}

function parseProductLine(line = "", context = {}) {
  const original = cleanLine(line);
  if (!original || original.length < 4 || isRejectedLine(original)) return null;

  const terminalPrice = findTerminalPrice(original);
  if (!terminalPrice || terminalPrice.value === null) return null;

  let body = original.slice(0, terminalPrice.start).trim();

  body = body
    .replace(/^[\-*•\d.\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!body || !/[A-ZÁÉÍÓÚÑ]/i.test(body)) return null;

  const presentation = extractPresentation(body);
  const codeName = splitCodeName(presentation.nombre);

  const nombre = cleanLine(codeName.nombre);
  if (!nombre || nombre.length < 2) return null;

  return {
    codigo: codeName.codigo,
    nombre,
    descripcion: nombre,
    presentacion: presentation.presentacion,
    precio: terminalPrice.value,
    moneda: detectCurrency(original, context),
    unidad: context.unidad || null,
    marca: context.marca || null,
    categoria: context.categoria || null,
    subcategoria: context.subcategoria || null,
    fuente: "parser-engine-v2",
    linea_original: original,
  };
}

export function parseTextProducts({ text = "", context = {} } = {}) {
  const normalized = cleanText(text);
  const lines = normalized.split("\n").map(cleanLine).filter(Boolean);

  const items = [];

  for (const line of lines) {
    const item = parseProductLine(line, context);
    if (item) items.push(item);
  }

  return {
    ok: true,
    engine: "parser-engine-v2",
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
    .map((item) => {
      const rawLine = item.linea_original || item.raw || "";
      const parsedFromRaw = rawLine ? parseProductLine(rawLine, context) : null;

      if (parsedFromRaw) return parsedFromRaw;

      const nombre = cleanLine(item.nombre || item.name || item.descripcion || "");
      const precio = normalizeNumber(item.precio ?? item.price ?? item.costo ?? item.cost);

      if (!nombre || precio === null) return null;

      return {
        codigo: item.codigo || item.code || null,
        nombre,
        descripcion: cleanLine(item.descripcion || item.description || nombre),
        presentacion: item.presentacion || item.presentation || null,
        precio,
        moneda: item.moneda || item.currency || detectCurrency(rawLine, context),
        unidad: item.unidad || item.unit || context.unidad || null,
        marca: item.marca || item.brand || context.marca || null,
        categoria: item.categoria || item.category || context.categoria || null,
        subcategoria: item.subcategoria || item.subcategory || context.subcategoria || null,
        fuente: "vision-engine-v2",
        linea_original: rawLine,
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    engine: "parser-engine-v2",
    source: "vision",
    total: items.length,
    items,
  };
}

export default {
  parseTextProducts,
  parseVisionProducts,
};