/* eslint-disable no-console */

export async function extractPdfPages(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("PDF inválido: buffer requerido.");
  }

  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {};
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = String(result?.text || "").trim();

    if (!text) {
      return {
        ok: true,
        total_pages: 0,
        pages: [],
      };
    }

    const parts = text
      .split(/\f|(?:\n\s*){4,}/g)
      .map((part) => part.trim())
      .filter(Boolean);

    const pages = (parts.length ? parts : [text]).map((pageText, index) => ({
      pagina: index + 1,
      text: pageText,
      chars: pageText.length,
    }));

    return {
      ok: true,
      total_pages: pages.length,
      pages,
    };
  } finally {
    await parser.destroy();
  }
}

export default {
  extractPdfPages,
};