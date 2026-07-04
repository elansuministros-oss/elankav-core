/* eslint-disable no-console */

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n")
    .trim();
}

function normalizeMoneyNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d.,]/g, "");

  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ""));
  }

  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  return Number(cleaned.replace(",", "."));
}

function parsePrice(text) {
  const source = String(text || "");

  const match = source.match(/\b(USD|US\$|U\$|C\$|NIO)\s*([0-9][0-9.,]*)\b/i);
  if (!match) return null;

  const monedaRaw = match[1].toUpperCase();
  const moneda = ["USD", "US$", "U$"].includes(monedaRaw) ? "USD" : "NIO";
  const precio = normalizeMoneyNumber(match[2]);

  if (!Number.isFinite(precio) || precio <= 0) return null;

  return {
    precio,
    moneda,
    priceText: match[0],
  };
}

function parsePresentation(text) {
  const match = String(text || "").match(
    /\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:M|MT|MTS|CM|MM)\b/i
  );

  return match ? match[0].replace(/\s+/g, "").toUpperCase() : null;
}

function cleanName(text, presentation, priceText) {
  let name = String(text || "");

  if (presentation) name = name.replace(presentation, " ");
  if (priceText) name = name.replace(priceText, " ");

  return name.replace(/\s+/g, " ").trim() || null;
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
    const priceData = parsePrice(textoOriginal);
    const presentacion = parsePresentation(textoOriginal);
    const nombre = cleanName(textoOriginal, presentacion, priceData?.priceText);

    const errores = [];

    if (!nombre) errores.push("NOMBRE_NO_DETECTADO");
    if (!presentacion) errores.push("PRESENTACION_NO_DETECTADA");
    if (!priceData?.precio) errores.push("PRECIO_NO_DETECTADO");
    if (!priceData?.moneda) errores.push("MONEDA_NO_DETECTADA");

    if (errores.length > 0) {
      rechazados.push({
        estado: "RECHAZADO",
        proveedor,
        texto_original: textoOriginal,
        errores,
      });
      continue;
    }

    registros.push({
      estado: "VALIDO",
      proveedor,
      nombre,
      presentacion,
      precio: priceData.precio,
      moneda: priceData.moneda,
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
