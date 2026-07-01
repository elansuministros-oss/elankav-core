/* eslint-disable no-console */

import { analyzeImageProducts } from "./vision-engine.js";
import { parseCatalogText, normalizeVisionItems } from "./parser-engine.js";
import { savePageItems } from "./save-engine.js";

export async function processPageSafe({
  proveedor,
  archivo = {},
  pagina = 1,
  text = "",
  image = null,
  visionResult = null,
  context = {},
  guardarAutomatico = false,
} = {}) {
  try {
    const ctx = {
      ...context,
      pagina,
      archivo_nombre: archivo.name || archivo.nombre || "",
      archivo_path: archivo.path || archivo.storage_path || "",
    };

    let vision = visionResult;

    if (!vision && image?.buffer?.length) {
      vision = await analyzeImageProducts({
        buffer: image.buffer,
        mime: image.mime || "image/png",
        text,
        context: ctx,
      });
    }

    let items = [];

    if (vision?.items?.length) {
      items = normalizeVisionItems({ items: vision.items, pagina, context: ctx });
    }

    if (!items.length && text) {
      const parsed = parseCatalogText({ text, pagina, context: ctx });
      items = parsed.items || [];
    }

    let save = {
      ok: true,
      guardado: false,
      guardados: 0,
      total: items.length,
      razon: guardarAutomatico ? "sin_items" : "guardar_automatico_false",
    };

    if (guardarAutomatico && items.length) {
      save = await savePageItems({
        proveedor,
        items,
        archivo,
        pagina,
      });
    }

    return {
      ok: true,
      pagina,
      source: vision?.source || "text-parser",
      chars: String(text || "").length,
      tiene_imagen: Boolean(image?.buffer?.length),
      items_detectados: items.length,
      items_guardados: Number(save.guardados || 0),
      guardado: Boolean(save.guardado),
      save,
      items,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      pagina,
      source: "page-engine-error",
      chars: String(text || "").length,
      tiene_imagen: Boolean(image?.buffer?.length),
      items_detectados: 0,
      items_guardados: 0,
      guardado: false,
      items: [],
      error: error.message || "Error procesando página EMC.",
    };
  }
}

export default {
  processPageSafe,
};
