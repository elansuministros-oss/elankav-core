/* eslint-disable no-console */

import { parseVisionProducts } from "./parser-engine.js";
import { savePageItems } from "./save-engine.js";
import { readEmcRecordsV2 } from "./record-reader-v2.js";

function mapV2Items(readerResult = {}) {
  return (readerResult.registros || []).map((item) => ({
    codigo: item.codigo || null,
    nombre: item.nombre,
    descripcion: item.nombre,
    presentacion: item.presentacion,
    precio: item.precio,
    moneda: item.moneda,
    observaciones: item.texto_original,
    linea_original: item.texto_original,
    estado_lectura: item.estado, pagina_origen: readerResult.pagina || null,
  }));
}

export async function processTextPage({
  proveedor,
  archivo,
  pagina = 1,
  text = "",
  context = {},
  guardarAutomatico = false,
} = {}) {
  console.log("=== EMC V2 TEXTO RECIBIDO ===");
console.log(text?.substring(0, 1000));
  const reader = readEmcRecordsV2(text, proveedor);
  const items = mapV2Items({ ...reader, pagina });
console.log("=== EMC V2 RESULTADO ===");
console.log(reader);

  const parsed = {
    ok: true,
    version: "EMC_RECORD_READER_V2",
    source: "text",
    items,
    rechazados: reader.registros_rechazados || [],
    total: reader.total || 0,
    validos: reader.validos || 0,
    total_rechazados: reader.rechazados || 0,
  };

  let saveResult = null;

  if (guardarAutomatico && items.length > 0) {
    saveResult = await savePageItems({
      proveedor,
      archivo,
      pagina,
      items,
    });
  }

  return {
    ok: true,
    type: "text-page",
    pagina,
    chars: String(text || "").length,
    items_detectados: items.length,
    items_guardados: saveResult?.guardado ? items.length : 0,
    parsed,
    save: saveResult,
  };
}

export async function processVisionPage({
  proveedor,
  archivo,
  pagina = 1,
  visionResult = {},
  context = {},
  guardarAutomatico = false,
} = {}) {
  const parsed = parseVisionProducts({
    visionResult,
    context,
  });

  let saveResult = null;

  if (guardarAutomatico) {
    saveResult = await savePageItems({
      proveedor,
      archivo,
      pagina,
      items: parsed.items,
    });
  }

  return {
    ok: true,
    type: "vision-page",
    pagina,
    items_detectados: parsed.items.length,
    items_guardados: saveResult?.guardado ? parsed.items.length : 0,
    parsed,
    save: saveResult,
  };
}

export async function processPageSafe(params = {}) {
  try {
    if (params.visionResult) {
      return await processVisionPage(params);
    }

    return await processTextPage(params);
  } catch (error) {
    return {
      ok: false,
      type: params.visionResult ? "vision-page" : "text-page",
      pagina: params.pagina || 1,
      error: error.message || "Error procesando pagina EMC.",
      items_detectados: 0,
      items_guardados: 0,
    };
  }
}

export default {
  processTextPage,
  processVisionPage,
  processPageSafe,
};
