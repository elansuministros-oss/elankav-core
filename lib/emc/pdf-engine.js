/* eslint-disable no-console */

export async function extractPdfPages(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("PDF inválido: buffer requerido.");
  }

  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;

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
        page: 1,
        text,
      },
    ],
  };
}

export default {
  extractPdfPages,
};