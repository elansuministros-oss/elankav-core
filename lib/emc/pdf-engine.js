/* eslint-disable no-console */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function extractPdfPages(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("PDF invÃ¡lido: buffer requerido.");
  }

  const result = await pdfParse(buffer);

  const text = String(result?.text || "").trim();
  const totalPages = Number(result?.numpages || result?.numrender || 1);

  if (!text) {
    return {
      total_pages: totalPages,
      pages: [],
    };
  }

  return {
    total_pages: totalPages,
    pages: [
      {
        pagina: 1,
        text,
      },
    ],
  };
}

export default {
  extractPdfPages,
};
