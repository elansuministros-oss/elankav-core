const fs = require("fs/promises");

async function cargarPdfJs() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function abrirPDF(filePath) {
  if (!filePath) {
    throw new Error("PDF Engine: falta filePath.");
  }

  const buffer = await fs.readFile(filePath);
  const { getDocument } = await cargarPdfJs();

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  return await loadingTask.promise;
}

async function obtenerInfoPDF(filePath) {
  const pdf = await abrirPDF(filePath);

  let metadata = null;

  try {
    metadata = await pdf.getMetadata();
  } catch {
    metadata = null;
  }

  return {
    paginas: pdf.numPages,
    totalPaginas: pdf.numPages,
    metadata,
  };
}

async function listarPaginas(filePath) {
  const info = await obtenerInfoPDF(filePath);
  const paginas = [];

  for (let i = 1; i <= info.paginas; i += 1) {
    paginas.push({
      numero: i,
      estado: "PENDIENTE",
      viewport: null,
      imagen: null,
      productos: [],
      errores: 0,
    });
  }

  return paginas;
}

async function obtenerPagina(filePath, numeroPagina) {
  const pdf = await abrirPDF(filePath);

  if (numeroPagina < 1 || numeroPagina > pdf.numPages) {
    throw new Error("PDF Engine: página fuera de rango.");
  }

  const pagina = await pdf.getPage(numeroPagina);
  const viewport = pagina.getViewport({ scale: 2 });

  return {
    numero: numeroPagina,
    viewport: {
      width: viewport.width,
      height: viewport.height,
      scale: viewport.scale,
    },
    pagina,
  };
}

async function obtenerTodasLasPaginas(filePath) {
  const info = await obtenerInfoPDF(filePath);
  const lista = [];

  for (let i = 1; i <= info.paginas; i += 1) {
    lista.push(await obtenerPagina(filePath, i));
  }

  return lista;
}

module.exports = {
  abrirPDF,
  obtenerInfoPDF,
  listarPaginas,
  obtenerPagina,
  obtenerTodasLasPaginas,
};