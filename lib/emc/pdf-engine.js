/* eslint-disable no-console */

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function asUint8Array(buffer) {
  if (!buffer) throw new Error("PDF buffer vacío.");
  if (buffer instanceof Uint8Array) return buffer;
  if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer);
  return new Uint8Array(Buffer.from(buffer));
}

async function extractTextFromPage(page) {
  try {
    const content = await page.getTextContent();
    return content.items
      .map((item) => String(item.str || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (error) {
    return "";
  }
}

async function renderPageToImage(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));

  await page.render({
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory,
  }).promise;

  const buffer = canvasAndContext.canvas.toBuffer("image/png");
  canvasFactory.destroy(canvasAndContext);

  return {
    buffer,
    mime: "image/png",
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
  };
}

export async function extractPdfPages(buffer, options = {}) {
  const maxPages = Number(options.maxPages || process.env.EMC_MAX_PDF_PAGES || 60);
  const renderScale = Number(options.renderScale || process.env.EMC_PDF_RENDER_SCALE || 2);

  const data = asUint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const totalPages = Number(pdf.numPages || 0);

  if (!totalPages) {
    throw new Error("PDF leído, pero pdf.numPages devolvió 0.");
  }

  const pages = [];
  const limit = Math.min(totalPages, maxPages);

  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await extractTextFromPage(page);
    const image = await renderPageToImage(page, renderScale);

    pages.push({
      pagina: pageNumber,
      text,
      chars: text.length,
      image,
      has_image: Boolean(image?.buffer?.length),
      render_width: image.width,
      render_height: image.height,
    });
  }

  return {
    ok: true,
    total_pages: totalPages,
    processed_pages: pages.length,
    truncated: totalPages > limit,
    pages,
  };
}

export default {
  extractPdfPages,
};
