/* eslint-disable no-console */

function cleanText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMoney(value) {
  const raw = String(value || "").trim();
  const moneda = /C\$|C\s*\$/i.test(raw) ? "NIO" : /USD|US\$|\$\s*\d/i.test(raw) ? "USD" : "NIO";
  const match = raw.match(/(?:C\$|C\s*\$|USD|US\$|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i);
  const precio = match ? Number(match[1].replace(/,/g, "")) : 0;
  return { precio: Number.isFinite(precio) ? precio : 0, moneda };
}

function inferCategory(text = "") {
  const t = text.toUpperCase();
  if (t.includes("NEÓN") || t.includes("NEON")) return "Neón Flex";
  if (t.includes("CINTA")) return "Cintas LED";
  if (t.includes("TRANSFORMADOR")) return "Transformadores";
  if (t.includes("MÓDULO") || t.includes("MODULO")) return "Módulos LED";
  if (t.includes("ACRÍLICO") || t.includes("ACRILICO") || t.includes("PVC") || t.includes("VINIL") || t.includes("LONA")) return "Materiales para Rotulación";
  if (t.includes("ADAPTADOR") || t.includes("CABLE") || t.includes("DIMMER") || t.includes("CONTROL")) return "Accesorios";
  return "General";
}

function titleCase(value = "") {
  const v = String(value || "").trim();
  if (!v) return "";
  return v
    .toLowerCase()
    .replace(/\b([a-záéíóúñü])/gi, (m) => m.toUpperCase())
    .replace(/\bLed\b/g, "LED")
    .replace(/\bRgb\b/g, "RGB")
    .replace(/\bPvc\b/g, "PVC");
}

export function normalizeProductItem(item = {}, fallback = {}) {
  const nombre = cleanText(item.nombre || item.name || item.producto || item.descripcion || fallback.nombre || "Producto EMC");
  const money = parseMoney(item.precio ?? item.price ?? item.precio_lista ?? item.costo ?? item.linea_original);

  return {
    codigo: cleanText(item.codigo || item.sku || item.referencia || ""),
    nombre: titleCase(nombre).slice(0, 180),
    descripcion: cleanText(item.descripcion || item.description || item.detalle || nombre).slice(0, 900),
    categoria: cleanText(item.categoria || fallback.categoria || inferCategory(`${nombre} ${item.descripcion || ""}`)),
    subcategoria: cleanText(item.subcategoria || item.tipo || "Sin clasificar"),
    marca: cleanText(item.marca || item.brand || ""),
    unidad: cleanText(item.unidad || item.presentacion || item.medida || "unidad"),
    presentacion: cleanText(item.presentacion || item.unidad || item.medida || "unidad"),
    precio: Number(item.precio_numero ?? money.precio ?? 0),
    moneda: cleanText(item.moneda || money.moneda || "NIO"),
    atributos: item.atributos && typeof item.atributos === "object" ? item.atributos : {},
    pagina: item.pagina || fallback.pagina || 1,
    imagen_referencia: cleanText(item.imagen_referencia || item.image || ""),
    linea_original: cleanText(item.linea_original || item.raw || item.descripcion || nombre),
  };
}

export function parseCatalogText({ text = "", pagina = 1, context = {} } = {}) {
  const source = cleanText(text);
  if (!source) return { ok: true, items: [], source: "text-empty" };

  const defaultCurrency = /MONEDA:\s*USD/i.test(source) ? "USD" : "NIO";

  const normalized = source
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/CATEGORÍA:/gi, "\nCATEGORÍA:")
    .trim();

  const categoryBlocks = normalized
    .split(/\n(?=CATEGORÍA:)/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const items = [];

  for (const block of categoryBlocks) {
    const catMatch = block.match(/^CATEGORÍA:\s*([^|]+?)(?=\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9])/i);
    const categoria = cleanText(catMatch?.[1] || "General").replace(/\s+(Lona|Adhesivo|Roll|PVC|Vinil).*$/i, "");

    const body = block.replace(/^CATEGORÍA:\s*[^ ]+\s*/i, "");

    const productRegex = /([^|]+?)\s*\|\s*Unidad:\s*([^|]+?)\s*\|\s*Precio\s*(USD|C\$|C)?\s*:\s*(Pendiente|[0-9]+(?:[.,][0-9]+)?)/gi;

    let match;
    while ((match = productRegex.exec(body)) !== null) {
      const nombre = cleanText(match[1])
        .replace(/^CATEGORÍA:\s*[^ ]+\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

      const unidad = cleanText(match[2] || "unidad");
      const moneda = /USD/i.test(match[3] || "") ? "USD" : defaultCurrency;
      const rawPrecio = String(match[4] || "").trim();

      const precio = /pendiente/i.test(rawPrecio)
        ? 0
        : Number(rawPrecio.replace(",", "."));

      if (!nombre || nombre.length < 4) continue;
      if (/^(xm|ozxm|precio usd|unidad)$/i.test(nombre)) continue;

      items.push(normalizeProductItem({
        nombre,
        descripcion: nombre,
        categoria,
        subcategoria: categoria,
        unidad,
        presentacion: unidad,
        precio_numero: Number.isFinite(precio) ? precio : 0,
        moneda,
        linea_original: `${nombre} | Unidad: ${unidad} | Precio ${moneda}: ${rawPrecio}`,
        pagina,
      }, { pagina, categoria, proveedor_nombre: context.proveedor_nombre }));
    }
  }

  return {
    ok: true,
    source: "text-eskolor-structured",
    total: items.length,
    items,
  };
}
export function normalizeVisionItems({ items = [], pagina = 1, context = {} } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeProductItem(item, { pagina, categoria: item?.categoria || "General", proveedor_nombre: context.proveedor_nombre }))
    .filter((item) => item.nombre && item.nombre !== "Producto EMC");
}

export default {
  parseMoney,
  parseCatalogText,
  normalizeProductItem,
  normalizeVisionItems,
};

