import fs from "fs/promises";
import * as XLSX from "xlsx";

export function normalizarTexto(valor = "") {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function nombreArchivo(archivo = {}) {
  return archivo.originalFilename || archivo.originalname || archivo.fileName || archivo.filename || archivo.name || archivo.nombre || "archivo";
}

function mimeArchivo(archivo = {}) {
  return archivo.mimetype || archivo.mimeType || archivo.mime || archivo.type || "";
}

function normalizarProveedor(valor = null, body = {}) {
  if (valor && typeof valor === "object") return valor;

  if (typeof valor === "string" && valor.trim()) {
    try {
      return JSON.parse(valor.trim());
    } catch {}
  }

  return {
    id: body.proveedor_id || null,
    nombre: body.proveedor_nombre || "Proveedor no definido"
  };
}

export function detectarMimeArchivo({ fileName = "", mimeType = "" }) {
  const nombre = String(fileName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();

  if (mime.includes("pdf") || nombre.endsWith(".pdf")) return "pdf";
  if (mime.includes("spreadsheet") || nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) return "excel";
  if (mime.includes("csv") || nombre.endsWith(".csv")) return "csv";
  if (mime.includes("image") || /\.(png|jpg|jpeg|webp)$/i.test(nombre)) return "imagen";
  if (mime.includes("text") || nombre.endsWith(".txt")) return "texto";

  return "desconocido";
}

export function detectarIva(valor = "") {
  const texto = normalizarTexto(valor).toLowerCase();

  if (texto.includes("iva incluido") || texto.includes("incluye iva")) return { detectado: true, incluido: true, porcentaje: 15 };
  if (texto.includes("+ iva") || texto.includes("mas iva") || texto.includes("más iva")) return { detectado: true, incluido: false, porcentaje: 15 };
  if (texto.includes("iva")) return { detectado: true, incluido: null, porcentaje: 15 };

  return { detectado: false, incluido: null, porcentaje: 15 };
}

export function detectarUnidad(texto = "") {
  const t = normalizarTexto(texto).toLowerCase();

  const reglas = [
    ["metro cuadrado", "m2"], ["m²", "m2"], ["m2", "m2"],
    ["metro lineal", "ml"], ["ml", "ml"],
    ["unidad", "unidad"], ["und", "unidad"],
    ["galon", "galon"], ["litro", "litro"], ["kg", "kg"],
    ["rollo", "rollo"], ["lamina", "lamina"], ["plancha", "plancha"],
    ["pieza", "pieza"], ["pliego", "pliego"], ["caja", "caja"], ["bolsa", "bolsa"]
  ];

  const encontrada = reglas.find(([clave]) => t.includes(clave));
  return encontrada ? encontrada[1] : "unidad";
}

export function clasificarCategoria(texto = "") {
  const t = normalizarTexto(texto).toLowerCase();

  if (t.includes("pintura") || t.includes("esmalte") || t.includes("sellador") || t.includes("barniz")) {
    return { categoria: "Pinturas", subcategoria: "Pinturas y recubrimientos" };
  }

  if (t.includes("vinil") || t.includes("lona") || t.includes("banner") || t.includes("microperforado")) {
    return { categoria: "Impresión y rotulación", subcategoria: "Sustratos imprimibles" };
  }

  if (t.includes("acrilico") || t.includes("pvc") || t.includes("acm")) {
    return { categoria: "Materiales rígidos", subcategoria: "Planchas y láminas" };
  }

  if (t.includes("led") || t.includes("fuente") || t.includes("transformador") || t.includes("neon")) {
    return { categoria: "Iluminación", subcategoria: "Componentes eléctricos" };
  }

  if (t.includes("brocha") || t.includes("rodillo") || t.includes("espátula") || t.includes("espatula") || t.includes("pistola")) {
    return { categoria: "Herramientas", subcategoria: "Aplicación e instalación" };
  }

  return { categoria: "General", subcategoria: "Sin clasificar" };
}

export function extraerPrecio(texto = "") {
  const t = String(texto || "");
  const match = t.match(/(?:C\$|USD|U\$|\$)\s*:?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)/i);

  if (!match) return null;

  const raw = String(match[1] || "").replace(/\s/g, "");

  if (raw.includes(",") && raw.includes(".")) return Number(raw.replace(/,/g, ""));
  if (raw.includes(",") && !raw.includes(".")) return Number(raw.replace(/\./g, "").replace(",", "."));
  if (raw.includes(".") && !raw.includes(",")) {
    const partes = raw.split(".");
    if (partes.length > 2) return Number(raw.replace(/\./g, ""));
    if (partes[1]?.length === 3) return Number(raw.replace(/\./g, ""));
  }

  return Number(raw);
}

export function extraerMedida(texto = "") {
  const match = String(texto || "").match(/(\d+(?:[.,]\d+)?)\s*(x|×)\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mts|yds|yd|pulg|"))?/i);

  if (!match) return null;

  return {
    ancho: Number(String(match[1]).replace(",", ".")),
    alto: Number(String(match[3]).replace(",", ".")),
    unidad: match[4] || null,
    texto: match[0]
  };
}

export function extraerCodigo(texto = "") {
  const match = String(texto || "").trim().match(/\b(?:COD|CÓDIGO|CODIGO|SKU|REF|REFERENCIA|MODELO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{1,})\b/i);
  return match ? match[1].toUpperCase() : null;
}

export function detectarMarca(texto = "") {
  const marcas = ["3M", "Avery", "Avery Dennison", "Oracal", "Orafol", "LG", "Siser", "Starflex", "Alucobond", "Sintra", "Sylvania", "Osram", "Vargasflex", "Promoplus", "LED Solutions"];
  const t = normalizarTexto(texto).toLowerCase();

  return marcas.find((m) => {
    const marca = normalizarTexto(m).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${marca}([^a-z0-9]|$)`, "i").test(t);
  }) || null;
}

function limpiarNombreProducto(linea = "") {
  return String(linea || "")
    .replace(/(?:C\$|USD|U\$|\$)\s*[0-9]+(?:[.,][0-9]{1,2})?/gi, "")
    .replace(/\+?\s*iva\b/gi, "")
    .replace(/\b(?:precio|unidad|marca)\b[:.]?/gi, "")
    .replace(/\b(?:codigo|código|cod|sku|ref|referencia)\s*[:#-]?\s*[A-Z0-9-]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function leerBufferArchivo(archivo = {}) {
  if (Buffer.isBuffer(archivo.buffer)) return archivo.buffer;
  if (Buffer.isBuffer(archivo.data)) return archivo.data;

  if (typeof archivo.buffer === "string") return Buffer.from(archivo.buffer, "base64");
  if (typeof archivo.data === "string") return Buffer.from(archivo.data, "base64");
  if (typeof archivo.base64 === "string") return Buffer.from(archivo.base64, "base64");
  if (typeof archivo.contenido_base64 === "string") return Buffer.from(archivo.contenido_base64, "base64");

  const ruta = archivo.filepath || archivo.path || archivo.tempFilePath || archivo.ruta_local || archivo.localPath;

  if (!ruta) return null;

  return await fs.readFile(ruta);
}

async function extraerTextoPdf(buffer) {
  if (!buffer || !buffer.length) return "";

  try {
    const modulo = await import("pdf-parse");
    const pdfParse = modulo.default || modulo;

    if (typeof pdfParse === "function") {
      const result = await pdfParse(buffer);
      return String(result?.text || "").trim();
    }
  } catch {}

  try {
    if (typeof globalThis.DOMMatrix === "undefined") {
      globalThis.DOMMatrix = class DOMMatrix {};
    }

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return String(result?.text || "").trim();
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    throw new Error(`No se pudo extraer texto del PDF: ${error?.message || "pdf-parse falló"}`);
  }
}

async function extraerTextoArchivo(archivo = {}) {
  const nombre = nombreArchivo(archivo);
  const mime = mimeArchivo(archivo);
  const tipo = detectarMimeArchivo({ fileName: nombre, mimeType: mime });

  const buffer = await leerBufferArchivo(archivo);

  if (!buffer) {
    return {
      tipo,
      texto: "",
      multimedia: tipo === "imagen" ? [{ nombre, mime, estado: "pendiente_ocr" }] : [],
      diagnostico: "archivo_sin_buffer_ni_ruta_local"
    };
  }

  if (tipo === "pdf") {
    const texto = await extraerTextoPdf(buffer);
    return { tipo, texto, multimedia: [], diagnostico: texto ? "pdf_texto_extraido" : "pdf_sin_texto_extraible" };
  }

  if (tipo === "excel") {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const textos = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      return [
        `=== HOJA: ${sheetName} ===`,
        ...rows.map((row) => row.map((cell) => String(cell || "").trim()).filter(Boolean).join(" | "))
      ].join("\n");
    });

    return { tipo, texto: textos.join("\n"), multimedia: [], diagnostico: "excel_texto_extraido" };
  }

  if (tipo === "csv" || tipo === "texto") {
    return { tipo, texto: buffer.toString("utf8"), multimedia: [], diagnostico: "texto_extraido" };
  }

  if (tipo === "imagen") {
    return {
      tipo,
      texto: "",
      multimedia: [{ nombre, mime, size: archivo.size || buffer.length, estado: "pendiente_ocr" }],
      diagnostico: "imagen_recibida_sin_vision_en_ai20_reset"
    };
  }

  return { tipo, texto: "", multimedia: [], diagnostico: "tipo_no_soportado" };
}

function esBasuraEMC(linea = "") {
  const t = normalizarTexto(linea).toLowerCase();

  if (!t || t.length < 3) return true;

  const basura = [
    "descripcion medida precio",
    "descripcion medida precio+iva",
    "precio+ iva",
    "precio+iva",
    "lista de precios 2026",
    "catalogo",
    "catalogo 2025",
    "sobre nosotros",
    "mision",
    "vision",
    "usos y aplicaciones",
    "caracteristicas",
    "colores disponibles",
    "todos los derechos reservados"
  ];

  if (basura.includes(t)) return true;
  if (t.includes("consultar terminos")) return true;
  if (t.includes("whatsapp")) return true;
  if (t.includes("www.")) return true;
  if (/^\d+$/.test(t)) return true;

  return false;
}

function esCategoriaEMC(linea = "") {
  const t = normalizarTexto(linea).toLowerCase();

  const categorias = [
    "lonas",
    "laminas",
    "viniles",
    "accesorios",
    "neon flex",
    "cintas led",
    "transformadores",
    "modulos led",
    "materiales para rotulacion",
    "tecnologia",
    "herramientas",
    "polarizados",
    "reflectivos"
  ];

  return categorias.some((c) => t.includes(c)) && !extraerPrecio(linea);
}

function tieneProductoEMC(linea = "") {
  const t = normalizarTexto(linea).toLowerCase();

  return Boolean(
    extraerPrecio(linea) ||
    extraerMedida(linea) ||
    /\b(vinil|lona|pvc|acrilico|neon|led|transformador|modulo|modulos|cinta|tape|roller|mesa|caja de luz|polarizado|reflectivo|transfer|primer|pegamento|fuente)\b/i.test(t)
  );
}

function codigoTemporalEMC(nombre = "", index = 0) {
  const base = normalizarTexto(nombre)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  return `EMC-${base || "ITEM"}-${String(index + 1).padStart(4, "0")}`;
}

export function procesarLineasCatalogo({ texto = "", proveedor = null }) {
  const iva = detectarIva(texto);

  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 2)
    .filter((x) => !/^={3,}/.test(x));

  const items = [];
  let categoriaActual = "";

  lineas.forEach((linea, index) => {
    if (esBasuraEMC(linea)) return;

    if (esCategoriaEMC(linea)) {
      categoriaActual = linea;
      return;
    }

    if (!tieneProductoEMC(linea)) return;

    const precio = extraerPrecio(linea);
    const medida = extraerMedida(linea);
    const unidad = detectarUnidad(linea);
    const clasificacion = clasificarCategoria(`${categoriaActual} ${linea}`);
    const codigo = extraerCodigo(linea);
    const marca = detectarMarca(linea);
    const nombre = limpiarNombreProducto(linea);

    if (!nombre || nombre.length < 4) return;
    if (esBasuraEMC(nombre)) return;

    items.push({
      codigo: codigo || codigoTemporalEMC(nombre, index),
      nombre,
      descripcion_original: linea,
      categoria_sugerida: clasificacion.categoria,
      subcategoria_sugerida: clasificacion.subcategoria,
      marca_sugerida: marca,
      unidad_sugerida: unidad,
      medida_detectada: medida,
      precio_detectado: precio,
      moneda_sugerida: linea.toLowerCase().includes("c$") || linea.toLowerCase().includes("nio") ? "NIO" : "USD",
      iva_detectado: iva,
      proveedor_sugerido:
        proveedor?.nombre ||
        proveedor?.nombre_comercial ||
        proveedor?.razonSocial ||
        proveedor?.razon_social ||
        "Proveedor no definido",
      proveedor_id: proveedor?.id || null,
      confianza: precio ? 0.86 : 0.62,
      requiere_revision: !precio || clasificacion.categoria === "General"
    });
  });

  return {
    ok: true,
    total_lineas: lineas.length,
    total_items_detectados: items.length,
    iva,
    items
  };
}

export async function analizarImportacionEMC({ body = {} }) {
  const proveedor = normalizarProveedor(body.proveedor, body);
  const archivos = Array.isArray(body.archivos) ? body.archivos : [];
  const textos = [];
  const multimedia = [];
  const archivosProcesados = [];

  if (body.texto_extraido || body.texto || body.csv) {
    textos.push(String(body.texto_extraido || body.texto || body.csv || ""));
    archivosProcesados.push({
      nombre: body.file_name || body.nombre_archivo || "texto_manual",
      mime: body.file_mime || body.mime_type || "text/plain",
      tipo: "texto",
      estado: "procesado",
      diagnostico: "texto_recibido_en_body"
    });
  }

  for (const archivo of archivos) {
    const nombre = nombreArchivo(archivo);
    const mime = mimeArchivo(archivo);
    const tipo = detectarMimeArchivo({ fileName: nombre, mimeType: mime });

    try {
      const extraido = await extraerTextoArchivo(archivo);

      if (extraido.texto) textos.push(extraido.texto);
      if (Array.isArray(extraido.multimedia)) multimedia.push(...extraido.multimedia);

      archivosProcesados.push({
        nombre,
        mime,
        size: archivo.size || archivo.length || 0,
        tipo: extraido.tipo || tipo,
        estado: "procesado",
        texto_extraido_chars: String(extraido.texto || "").length,
        diagnostico: extraido.diagnostico || "procesado"
      });
    } catch (error) {
      archivosProcesados.push({
        nombre,
        mime,
        size: archivo.size || 0,
        tipo,
        estado: "error",
        error: error?.message || "No se pudo procesar el archivo"
      });
    }
  }

  const textoUnificado = textos.join("\n\n").trim();

  if (!textoUnificado && !multimedia.length) {
    return {
      ok: false,
      estado: "sin_contenido_extraible",
      proveedor,
      archivos: archivosProcesados,
      mensaje: "CORE recibió archivos, pero no pudo extraer texto útil para EMC.",
      siguiente_paso: "Revisar que CORE esté descargando el archivo de Storage y enviando filepath, buffer o base64 hacia analizarImportacionEMC()."
    };
  }

  const propuesta = textoUnificado
    ? procesarLineasCatalogo({ texto: textoUnificado, proveedor })
    : {
        ok: true,
        total_lineas: 0,
        total_items_detectados: 0,
        iva: detectarIva(""),
        items: []
      };

  return {
    ok: true,
    modo: archivos.length ? "analisis_archivos" : "analisis_texto",
    proveedor,
    tipo_proveedor: body.tipo_proveedor || "materiales",
    modo_importacion: body.modo_importacion || "catalogo_mas_lista",
    notas: body.notas || "",
    archivos: archivosProcesados,
    multimedia,
    propuesta,
    resumen: {
      archivos_recibidos: archivos.length,
      archivos_procesados: archivosProcesados.filter((a) => a.estado === "procesado").length,
      archivos_error: archivosProcesados.filter((a) => a.estado === "error").length,
      imagenes_pendientes_ocr: multimedia.length,
      items_detectados: propuesta.items.length,
      texto_unificado_chars: textoUnificado.length
    },
    siguiente_paso: "Revisar propuesta en ELANVISUAL antes de guardar en EMC."
  };
}
