import fs from "fs/promises";
import * as XLSX from "xlsx";
import { analizarArchivosConVisionEMC } from "./emc-vision-engine.js";

export function normalizarTexto(valor = "") {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizarProveedor(valor = null, body = {}) {
  if (valor && typeof valor === "object") return valor;

  if (typeof valor === "string" && valor.trim()) {
    const limpio = valor.trim();

    try {
      return JSON.parse(limpio);
    } catch {
      const id = limpio.match(/id\s*:\s*([^,}]+)/i)?.[1]?.replace(/["']/g, "").trim();
      const nombre = limpio.match(/nombre\s*:\s*([^,}]+)/i)?.[1]?.replace(/["']/g, "").trim();

      if (id || nombre) {
        return {
          id: id || null,
          nombre: nombre || body.proveedor_nombre || "Proveedor no definido"
        };
      }
    }
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

  if (texto.includes("iva incluido") || texto.includes("incluye iva")) {
    return { detectado: true, incluido: true, porcentaje: 15 };
  }

  if (texto.includes("+ iva") || texto.includes("mas iva") || texto.includes("más iva")) {
    return { detectado: true, incluido: false, porcentaje: 15 };
  }

  if (texto.includes("iva")) {
    return { detectado: true, incluido: null, porcentaje: 15 };
  }

  return { detectado: false, incluido: null, porcentaje: 15 };
}

export function detectarUnidad(texto = "") {
  const t = normalizarTexto(texto).toLowerCase();

  const reglas = [
    ["metro cuadrado", "m2"], ["m²", "m2"], ["m2", "m2"],
    ["metro lineal", "ml"], ["ml", "ml"],
    ["unidad", "unidad"], ["und", "unidad"],
    ["galon", "galon"], ["galón", "galon"],
    ["litro", "litro"], ["kg", "kg"], ["libra", "lb"],
    ["rollo", "rollo"], ["lamina", "lamina"], ["lámina", "lamina"],
    ["plancha", "plancha"], ["pieza", "pieza"], ["pliego", "pliego"],
    ["caja", "caja"], ["bolsa", "bolsa"]
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

  if (t.includes("acrilico") || t.includes("acrílico") || t.includes("pvc") || t.includes("acm")) {
    return { categoria: "Materiales rígidos", subcategoria: "Planchas y láminas" };
  }

  if (t.includes("led") || t.includes("fuente") || t.includes("transformador")) {
    return { categoria: "Iluminación", subcategoria: "Componentes eléctricos" };
  }

  if (t.includes("brocha") || t.includes("rodillo") || t.includes("espatula") || t.includes("espátula") || t.includes("pistola")) {
    return { categoria: "Herramientas", subcategoria: "Aplicación e instalación" };
  }

  return { categoria: "General", subcategoria: "Sin clasificar" };
}

export function extraerPrecio(texto = "") {
  const t = String(texto || "");
  const match = t.match(/(?:C\$|USD|U\$|\$)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);

  if (!match) return null;

  const n = String(match[1] || "").replace(/\s/g, "");
  if (n.includes(",") && n.includes(".")) return Number(n.replace(/,/g, ""));
  if ((n.match(/,/g) || []).length === 1 && n.split(",")[1]?.length <= 2) return Number(n.replace(",", "."));
  return Number(n.replace(/,/g, ""));
}

export function extraerMedida(texto = "") {
  const t = String(texto || "");
  const match = t.match(/(\d+(?:[.,]\d+)?)\s*(x|×)\s*(\d+(?:[.,]\d+)?)(?:\s*(cm|mm|m|pulg|"))?/i);

  if (!match) return null;

  return {
    ancho: Number(String(match[1]).replace(",", ".")),
    alto: Number(String(match[3]).replace(",", ".")),
    unidad: match[4] || null,
    texto: match[0]
  };
}

export function extraerCodigo(texto = "") {
  const t = String(texto || "").trim();
  const match = t.match(/\b(?:COD|CÓDIGO|CODIGO|SKU|REF|REFERENCIA)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/i);
  return match ? match[1].toUpperCase() : null;
}

export function detectarMarca(texto = "") {
  const marcas = [
    "3M", "Avery", "Avery Dennison", "Oracal", "Orafol", "LG", "Siser",
    "Starflex", "Alucobond", "Sintra", "Sylvania", "Osram",
    "Sherwin Williams", "Sur", "Protecto", "Lanco", "Comex"
  ];

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

async function extraerTextoPdf(buffer) {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {};
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result?.text || "";
  } finally {
    await parser.destroy();
  }
}

async function extraerTextoArchivo(archivo = {}) {
  const tipo = detectarMimeArchivo({
    fileName: archivo.originalFilename,
    mimeType: archivo.mimetype
  });

  if (!archivo.filepath) {
    return {
      tipo,
      texto: "",
      multimedia: tipo === "imagen"
        ? [{ nombre: archivo.originalFilename, mime: archivo.mimetype, estado: "pendiente_ocr" }]
        : []
    };
  }

  if (tipo === "pdf") {
    const buffer = await fs.readFile(archivo.filepath);
    const texto = await extraerTextoPdf(buffer);
    return { tipo, texto, multimedia: [] };
  }

  if (tipo === "excel") {
    const buffer = await fs.readFile(archivo.filepath);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const textos = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      return [
        `=== HOJA: ${sheetName} ===`,
        ...rows.map((row) => row.map((cell) => String(cell || "").trim()).filter(Boolean).join(" | "))
      ].join("\n");
    });

    return { tipo, texto: textos.join("\n"), multimedia: [] };
  }

  if (tipo === "csv" || tipo === "texto") {
    const buffer = await fs.readFile(archivo.filepath);
    return { tipo, texto: buffer.toString("utf8"), multimedia: [] };
  }

  if (tipo === "imagen") {
    return {
      tipo,
      texto: "",
      multimedia: [{
        nombre: archivo.originalFilename,
        mime: archivo.mimetype,
        size: archivo.size,
        estado: "pendiente_ocr",
        nota: "Imagen recibida. OCR/visión se conectará en la siguiente fase."
      }]
    };
  }

  return { tipo, texto: "", multimedia: [] };
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

  return (
    extraerPrecio(linea) ||
    extraerMedida(linea) ||
    /\b(vinil|lona|pvc|acrilico|neon|led|transformador|modulo|cinta|tape|roller|mesa|caja de luz|polarizado|reflectivo|transfer|primer|pegamento)\b/i.test(t)
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

export async function analizarImportacionEMC({ body = {}, openai = null }) {
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
      tipo: "texto"
    });
  }

  for (const archivo of archivos) {
    const tipo = detectarMimeArchivo({
      fileName: archivo.originalFilename,
      mimeType: archivo.mimetype
    });

    try {
      const extraido = await extraerTextoArchivo(archivo);

      if (extraido.texto) textos.push(extraido.texto);
      if (Array.isArray(extraido.multimedia)) multimedia.push(...extraido.multimedia);

      archivosProcesados.push({
        nombre: archivo.originalFilename || "archivo",
        mime: archivo.mimetype || "",
        size: archivo.size || 0,
        tipo: extraido.tipo || tipo,
        estado: "procesado"
      });
    } catch (error) {
      archivosProcesados.push({
        nombre: archivo.originalFilename || "archivo",
        mime: archivo.mimetype || "",
        size: archivo.size || 0,
        tipo,
        estado: "error",
        error: error?.message || "No se pudo procesar el archivo"
      });
    }
  }

  let textoUnificado = textos.join("\n\n").trim();
  let vision = null;

  if (!textoUnificado && archivos.length) {
    try {
      vision = await analizarArchivosConVisionEMC({
        archivos,
        proveedor,
        notas: body.notas || ""
      });

      if (vision?.texto) {
        textoUnificado = String(vision.texto || "").trim();
      }
    } catch (error) {
      vision = {
        ok: false,
        error: error?.message || "No se pudo ejecutar visión EMC"
      };
    }
  }

  if (!textoUnificado && !multimedia.length) {
    return {
      ok: false,
      estado: "sin_contenido_extraible",
      proveedor,
      archivos: archivosProcesados,
      vision,
      mensaje: "CORE recibió archivos, pero no pudo extraer texto útil para EMC.",
      siguiente_paso: "Subir PDF con texto seleccionable, Excel, CSV o TXT. Las imágenes quedan para OCR/visión en fase siguiente."
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
      items_detectados: propuesta.items.length
    },
    siguiente_paso: "Revisar propuesta en ELANVISUAL antes de guardar en EMC."
  };
}
