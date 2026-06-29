export function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
    ["metro cuadrado", "m2"],
    ["m²", "m2"],
    ["m2", "m2"],
    ["metro lineal", "ml"],
    ["ml", "ml"],
    ["unidad", "unidad"],
    ["und", "unidad"],
    ["galon", "galon"],
    ["galón", "galon"],
    ["litro", "litro"],
    ["kg", "kg"],
    ["libra", "lb"],
    ["rollo", "rollo"],
    ["lamina", "lamina"],
    ["lámina", "lamina"],
    ["plancha", "plancha"],
    ["pieza", "pieza"]
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

  if (t.includes("brocha") || t.includes("rodillo") || t.includes("espátula") || t.includes("pistola")) {
    return { categoria: "Herramientas", subcategoria: "Aplicación e instalación" };
  }

  return { categoria: "General", subcategoria: "Sin clasificar" };
}

export function extraerPrecio(texto = "") {
  const t = String(texto || "");
  const match = t.match(/(?:C\$|\$|USD|U\$)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);

  if (!match) return null;

  return Number(String(match[1]).replace(",", "."));
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

export function procesarLineasCatalogo({ texto = "", proveedor = null }) {
  const iva = detectarIva(texto);

  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3);

  const items = lineas
    .map((linea) => {
      const precio = extraerPrecio(linea);
      const medida = extraerMedida(linea);
      const unidad = detectarUnidad(linea);
      const clasificacion = clasificarCategoria(linea);

      const nombre = linea
        .replace(/(?:C\$|\$|USD|U\$)?\s*[0-9]+(?:[.,][0-9]{1,2})?/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!nombre || nombre.length < 3) return null;

      return {
        nombre,
        descripcion_original: linea,
        categoria_sugerida: clasificacion.categoria,
        subcategoria_sugerida: clasificacion.subcategoria,
        marca_sugerida: null,
        unidad_sugerida: unidad,
        medida_detectada: medida,
        precio_detectado: precio,
        moneda_sugerida: linea.toLowerCase().includes("c$") ? "NIO" : "USD",
        iva_detectado: iva,
        proveedor_sugerido: proveedor?.nombre || proveedor?.nombre_comercial || "Proveedor no definido",
        confianza: precio ? 0.72 : 0.48,
        requiere_revision: !precio
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    total_lineas: lineas.length,
    total_items_detectados: items.length,
    iva,
    items
  };
}

export async function analizarImportacionEMC({ body = {}, openai = null }) {
  const proveedor = body.proveedor || {
    nombre: body.proveedor_nombre || "Centro de Pinturas Vargas"
  };

  const archivo = {
    nombre: body.file_name || body.nombre_archivo || "",
    mime: body.file_mime || body.mime_type || "",
    tipo: detectarMimeArchivo({
      fileName: body.file_name || body.nombre_archivo || "",
      mimeType: body.file_mime || body.mime_type || ""
    })
  };

  const texto = body.texto_extraido || body.texto || body.csv || "";

  if (texto) {
    const resultado = procesarLineasCatalogo({ texto, proveedor });

    return {
      ok: true,
      modo: "analisis_texto",
      proveedor,
      archivo,
      propuesta: resultado,
      siguiente_paso: "Revisar propuesta en ELANVISUAL antes de guardar en EMC."
    };
  }

  return {
    ok: false,
    estado: "archivo_recibido_sin_texto",
    proveedor,
    archivo,
    mensaje:
      "CORE recibió la solicitud EMC, pero aún falta enviar texto extraído o habilitar extracción binaria para PDF/Excel/imagen.",
    siguiente_paso:
      "ELANVISUAL debe enviar texto_extraido o se debe conectar extracción OCR/PDF en CORE."
  };
}
