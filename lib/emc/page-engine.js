/* eslint-disable no-console */

import { parseTextProducts, parseVisionProducts } from "./parser-engine.js";
import { savePageItems } from "./save-engine.js";

export async function processTextPage({
  proveedor,
  archivo,
  pagina = 1,
  text = "",
  context = {},
  guardarAutomatico = false,
} = {}) {
  const parsed = parseTextProducts({
    text,
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
    type: "text-page",
    pagina,
    chars: String(text || "").length,
    items_detectados: parsed.items.length,
    items_guardados: saveResult?.guardado ? parsed.items.length : 0,
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