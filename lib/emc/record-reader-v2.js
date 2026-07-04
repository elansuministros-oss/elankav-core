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

  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ""));
  }

  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  return Number(cleaned.replace(",", "."));
}

function parseRegistroLineal(text) {
  const source = normalizeText(text);

  const currencyMatch = source.match(/(C\$|USD|US\$|U\$|NIO)\s*$/i);
  if (!currencyMatch) return null;

  const monedaRaw = currencyMatch[1].toUpperCase();
  const moneda = ["C$", "NIO"].includes(monedaRaw) ? "NIO" : "USD";

  const withoutCurrency = source.slice(0, currencyMatch.index).trim();

  const priceMatch = withoutCurrency.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/);
  if (!priceMatch) return null;

  const precio = normalizeMoneyNumber(priceMatch[1]);
  if (!Number.isFinite(precio) || precio <= 0) return null;

  const beforePrice = withoutCurrency.slice(0, priceMatch.index).trim();

  const presentationPatterns = [
    /(\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM))\s*$/i,
    /(\d+(?:[.,]\d+)?\s*["”])\s*$/i,
    /(UNIDAD|UND|ROLLO|LITRO|GALON|YARDAS?|YDS|YD|M2|M²)\s*$/i,
  ];

  let presentacion = null;
  let nombre = beforePrice;

  for (const pattern of presentationPatterns) {
    const match = beforePrice.match(pattern);
    if (match) {
      presentacion = match[1].replace(/\s+/g, " ").trim().toUpperCase();
      nombre = beforePrice.slice(0, match.index).trim();
      break;
    }
  }

  if (!nombre || !presentacion) return null;

  return {
    nombre: nombre.replace(/\s+/g, " ").trim(),
    presentacion,
    precio,
    moneda,
  };
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
        errores: [
          "REGISTRO_NO_ESTRUCTURABLE",
        ],
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
