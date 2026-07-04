/* eslint-disable no-console */

export async function extractPdfPages(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("PDF inválido: buffer requerido.");
  }

  const data = new Uint8Array(buffer);

   if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {};
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();

    const text = String(result?.text || "").trim();
    const totalPages = Number(
      result?.total ||
        result?.total_pages ||
        result?.numpages ||
        1
    );

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
  } finally {
    await parser.destroy();
  }
}

export default {
  extractPdfPages,
};