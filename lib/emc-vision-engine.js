import fs from "fs";
import OpenAI from "openai";

function limpiarJson(texto = "") {
  return String(texto || "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function analizarArchivosConVisionEMC({ archivos = [], proveedor = {}, notas = "" }) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      texto: "",
      items: [],
      error: "OPENAI_API_KEY no configurada"
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const archivosOpenAI = [];

  for (const archivo of archivos) {
    if (!archivo?.filepath) continue;

    const uploaded = await client.files.create({
      file: fs.createReadStream(archivo.filepath),
      purpose: "assistants"
    });

    archivosOpenAI.push({
      file_id: uploaded.id,
      nombre: archivo.originalFilename || "archivo"
    });
  }

  if (!archivosOpenAI.length) {
    return {
      ok: false,
      texto: "",
      items: [],
      error: "No hay archivos válidos para visión"
    };
  }

  const content = [
    {
      type: "input_text",
      text: `
Analizá estos documentos de proveedor para el Catálogo Maestro EMC de ELANKAV.

Proveedor:
${JSON.stringify(proveedor, null, 2)}

Notas internas:
${notas || ""}

Objetivo:
Extraer productos, familias, marcas, medidas, unidades y precios visibles.
Si el documento es catálogo visual, extraé productos aunque estén en imágenes.
Si el documento es lista de precios, extraé líneas con precio.

Respondé SOLO JSON válido con esta estructura:
{
  "texto_extraido": "texto consolidado útil",
  "items": [
    {
      "codigo": "",
      "nombre": "",
      "descripcion_original": "",
      "categoria_sugerida": "",
      "subcategoria_sugerida": "",
      "marca_sugerida": "",
      "unidad_sugerida": "",
      "medida_detectada": null,
      "precio_detectado": null,
      "moneda_sugerida": "NIO",
      "requiere_revision": true
    }
  ]
}
`
    },
    ...archivosOpenAI.map((a) => ({
      type: "input_file",
      file_id: a.file_id
    }))
  ];

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content
      }
    ]
  });

  const raw = response.output_text || "";

  try {
    const json = JSON.parse(limpiarJson(raw));

    return {
      ok: true,
      texto: json.texto_extraido || "",
      items: Array.isArray(json.items) ? json.items : [],
      raw
    };
  } catch (error) {
    return {
      ok: true,
      texto: raw,
      items: [],
      raw,
      parse_error: error.message
    };
  }
}
