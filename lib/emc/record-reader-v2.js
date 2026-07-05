/* eslint-disable no-console */

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n")
    .trim();
}

function normalizeMoneyNumber(value) {
  const cleaned = String(value || "").replace(/[^\d.,]/g, "");

  if (/^\d{1,3}(,\d{3})+(\.\d{1,4})?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ""));
  }

  if (/^\d{1,3}(\.\d{3})+(,\d{1,4})?$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  return Number(cleaned.replace(",", "."));
}

function cleanName(value) {
  return String(value || "")
    .replace(/[_/]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findPresentation(text) {
  const patterns = [
    /\b\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM)\b/i,
    /\b\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM)?\s*\/?\s*rol\b/i,
    /\b\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM)?\s*\/?\s*pza\b/i,
    /\b(?:UND|UNIDAD|ROLLO|ROL|LITRO|GALON|YARDAS?|YDS|YD|M2|M²)\b/i,
  ];

  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return match[0].replace(/\s+/g, "").replace(/\/$/g, "").toUpperCase();
  }

  return null;
}

function parseMixedUsdCordobaLine(source) {
  const text = normalizeText(source);

  // Caso: Producto ... $ 43.00 C$ 1,612.50 C$ 1,854.38
  const usdMatch = text.match(/(?:^|\s)(?:USD|US\$|U\$|\$)\s*([0-9][0-9.,]*)/i);
  if (!usdMatch) return null;

  const precio = normalizeMoneyNumber(usdMatch[1]);
  if (!Number.isFinite(precio) || precio <= 0) return null;

  const beforeUsd = text.slice(0, usdMatch.index).trim();
  const presentacion = findPresentation(beforeUsd) || findPresentation(text);

  let nombre = beforeUsd;
  if (presentacion) {
    nombre = nombre.replace(presentacion, " ");
  }

  nombre = cleanName(nombre);

  if (!nombre || !presentacion) return null;

  return {
    nombre,
    presentacion,
    precio,
    moneda: "USD",
    moneda_origen: "USD",
    precio_origen: precio,
    texto_original: text,
  };
}

function parseCordobaSuffixLine(source) {
  const text = normalizeText(source);

  // Caso: Producto1.02X50M1,861.06C$
  const currencyMatch = text.match(/(C\$|NIO)\s*$/i);
  if (!currencyMatch) return null;

  const withoutCurrency = text.slice(0, currencyMatch.index).trim();

  const priceMatch = withoutCurrency.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,4})?|[0-9]+(?:\.[0-9]{1,4})?)\s*$/);
  if (!priceMatch) return null;

  const precio = normalizeMoneyNumber(priceMatch[1]);
  if (!Number.isFinite(precio) || precio <= 0) return null;

  const beforePrice = withoutCurrency.slice(0, priceMatch.index).trim();
  const presentacion = findPresentation(beforePrice);
  if (!presentacion) return null;

  let nombre = beforePrice.replace(presentacion, " ");
  nombre = cleanName(nombre);

  if (!nombre) return null;

  return {
    nombre,
    presentacion,
    precio,
    moneda: "NIO",
    moneda_origen: "NIO",
    precio_origen: precio,
    texto_original: text,
  };
}

function parseUsdOnlyLine(source) {
  const text = normalizeText(source);

  const usdMatch = text.match(/(?:USD|US\$|U\$|\$)\s*([0-9][0-9.,]*)\s*$/i);
  if (!usdMatch) return null;

  const precio = normalizeMoneyNumber(usdMatch[1]);
  if (!Number.isFinite(precio) || precio <= 0) return null;

  const beforeUsd = text.slice(0, usdMatch.index).trim();
  const presentacion = findPresentation(beforeUsd) || findPresentation(text);

  let nombre = beforeUsd;
  if (presentacion) nombre = nombre.replace(presentacion, " ");

  nombre = cleanName(nombre);

  if (!nombre || !presentacion) return null;

  return {
    nombre,
    presentacion,
    precio,
    moneda: "USD",
    moneda_origen: "USD",
    precio_origen: precio,
    texto_original: text,
  };
}

function parseRegistroLineal(text) {
  // Prioridad 1: si hay USD y C$ en la misma línea, manda USD.
  const mixed = parseMixedUsdCordobaLine(text);
  if (mixed) return mixed;

  // Prioridad 2: línea solo USD.
  const usdOnly = parseUsdOnlyLine(text);
  if (usdOnly) return usdOnly;

  // Prioridad 3: línea C$ pegada al final.
  const cordoba = parseCordobaSuffixLine(text);
  if (cordoba) return cordoba;

  return null;
}

function splitCandidateLines(datosRecibidos) {
  if (Array.isArray(datosRecibidos)) {
    return datosRecibidos.map((x) => {
      if (typeof x === "string") return x;
      return [
        x.nombre,
        x.descripcion,
        x.presentacion,
        x.precio,
        x.moneda,
      ].filter(Boolean).join(" ");
    });
  }

  return normalizeText(datosRecibidos)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function readEmcRecordsV2(datosRecibidos, proveedor = null) {
  const lines = splitCandidateLines(datosRecibidos);

  const registros = [];
  const rechazados = [];

  for (const line of lines) {
    const textoOriginal = normalizeText(line);
    const parsed = parseRegistroLineal(textoOriginal);

    if (!parsed) {
      rechazados.push({
        estado: "RECHAZADO",
        proveedor,
        texto_original: textoOriginal,
        errores: ["REGISTRO_NO_ESTRUCTURABLE"],
      });
      continue;
    }

    registros.push({
      estado: "VALIDO",
      proveedor,
      nombre: parsed.nombre,
      presentacion: parsed.presentacion,
      precio: parsed.precio,
      moneda: parsed.moneda,
      precio_origen: parsed.precio_origen,
      moneda_origen: parsed.moneda_origen,
      texto_original: textoOriginal,
    });
  }

  return {
    ok: true,
    version: "EMC_RECORD_READER_V2",
    total: lines.length,
    validos: registros.length,
    rechazados: rechazados.length,
    registros,
    registros_rechazados: rechazados,
  };
}
