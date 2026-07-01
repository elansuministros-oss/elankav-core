/* eslint-disable no-console */

import { parseCatalogText, normalizeVisionItems } from "./parser-engine.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";

function safeJsonParse(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function imageToDataUrl(buffer, mime = "image/png") {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mime};base64,${base64}`;
}

function buildPrompt({ context = {}, text = "" } = {}) {
  return `
Eres el importador visual EMC de ELANKAV.

Analiza esta página de catálogo de proveedor y extrae productos reales con precio.

Debes devolver SOLO JSON válido con esta estructura:
{
  "items": [
    {
      "nombre": "Nombre comercial del producto",
      "descripcion": "Descripción técnica corta",
      "categoria": "Categoría",
      "subcategoria": "Subcategoría",
      "marca": "",
      "unidad": "unidad / metro / rollo / lámina / set",
      "presentacion": "presentación visible",
      "precio": 0,
      "moneda": "NIO o USD",
      "atributos": {
        "voltaje": "",
        "potencia": "",
        "ip": "",
        "color": "",
        "medida": ""
      },
      "imagen_referencia": "descripción breve de la imagen del producto",
      "linea_original": "texto o zona de donde salió"
    }
  ]
}

Reglas:
- Extrae solo productos con precio o productos claramente vendibles.
- Moneda C$ = NIO.
- Símbolo $ sin C delante = USD.
- No inventes precios.
- Si hay varios precios en una tabla, crea varios items.
- No incluyas páginas de portada, índice, usos o aplicaciones si no hay producto/precio.
- Proveedor: ${context.proveedor_nombre || "Proveedor EMC"}.
- Texto OCR/base disponible:
${text || ""}
`.trim();
}

export async function analyzeImageProducts({ buffer, mime = "image/png", context = {}, text = "" } = {}) {
  if (!buffer?.length) {
    return { ok: false, error: "Imagen vacía para Vision.", items: [] };
  }

  if (!OPENAI_API_KEY) {
    const fallback = parseCatalogText({ text, pagina: context.pagina || 1, context });
    return {
      ok: true,
      source: "fallback-no-openai-key",
      items: fallback.items || [],
      warning: "OPENAI_API_KEY no configurada; se usó parser de texto.",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.EMC_VISION_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt({ context, text }) },
              {
                type: "image_url",
                image_url: {
                  url: imageToDataUrl(buffer, mime),
                  detail: "high",
                },
              },
            ],
          },
        ],
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      const fallback = parseCatalogText({ text, pagina: context.pagina || 1, context });
      return {
        ok: fallback.items?.length > 0,
        source: "fallback-openai-error",
        error: json?.error?.message || "OpenAI Vision error.",
        items: fallback.items || [],
      };
    }

    const content = json?.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(content);
    const items = normalizeVisionItems({
      items: parsed?.items || [],
      pagina: context.pagina || 1,
      context,
    });

    if (!items.length && text) {
      const fallback = parseCatalogText({ text, pagina: context.pagina || 1, context });
      return {
        ok: true,
        source: "fallback-empty-vision",
        items: fallback.items || [],
        vision_raw_empty: true,
      };
    }

    return {
      ok: true,
      source: "openai-vision",
      items,
      raw_total: parsed?.items?.length || 0,
    };
  } catch (error) {
    const fallback = parseCatalogText({ text, pagina: context.pagina || 1, context });
    return {
      ok: fallback.items?.length > 0,
      source: "fallback-exception",
      error: error.message || "Error procesando Vision.",
      items: fallback.items || [],
    };
  }
}

export default {
  analyzeImageProducts,
};
