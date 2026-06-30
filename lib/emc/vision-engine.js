/* eslint-disable no-console */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function bufferToDataUrl(buffer, mime = "image/png") {
  const safeMime = mime || "image/png";
  return `data:${safeMime};base64,${buffer.toString("base64")}`;
}

function extractJson(text = "") {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function analyzeImageProducts({ buffer, mime = "image/png", context = {} } = {}) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error: "OPENAI_API_KEY no configurada en CORE.",
      items: [],
    };
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      ok: false,
      error: "Imagen invalida: buffer requerido.",
      items: [],
    };
  }

  const dataUrl = bufferToDataUrl(buffer, mime);

  const prompt = `
Analiza esta imagen como catálogo/lista de precios de proveedor para EMC.

Devuelve únicamente JSON válido con esta forma:
{
  "items": [
    {
      "codigo": null,
      "nombre": "",
      "descripcion": "",
      "precio": null,
      "moneda": null,
      "unidad": null,
      "marca": null,
      "categoria": null,
      "subcategoria": null
    }
  ]
}

Reglas:
- No inventes productos.
- Si no hay precio visible, usa null.
- Si no hay código visible, usa null.
- Extrae solo productos, materiales, insumos, herramientas o servicios vendibles.
- Ignora encabezados, totales, teléfonos, direcciones y textos decorativos.
- Contexto proveedor: ${JSON.stringify(context)}
`.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.EMC_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || "Error OpenAI Vision.",
      items: [],
      raw: data,
    };
  }

  const outputText =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])?.map((part) => part.text || "").join("\n") ||
    "";

  const json = extractJson(outputText);

  if (!json) {
    return {
      ok: false,
      error: "OpenAI Vision no devolvio JSON valido.",
      items: [],
      raw: data,
      outputText,
    };
  }

  return {
    ok: true,
    engine: "vision-engine",
    items: Array.isArray(json.items) ? json.items : [],
    raw: json,
  };
}

export default {
  analyzeImageProducts,
};