/* eslint-disable no-console */

import { createSupabaseServerClient } from "./storage-engine.js";

function text(value, fallback = null) {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slug(value = "", prefix = "EMC") {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${prefix}-${base || "ITEM"}`;
}

async function oneByName(supabase, table, nombre, extra = {}) {
  const clean = text(nombre, "General");

  let { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("nombre", clean)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const created = await supabase
    .from(table)
    .insert({ nombre: clean, ...extra })
    .select()
    .single();

  if (created.error) throw created.error;
  return created.data;
}

async function crearBaseCatalogo({ supabase, item, index }) {
  const nombre = text(item.nombre || item.descripcion, `Producto EMC ${index + 1}`);
  const categoriaNombre = text(item.categoria, "General");
  const subcategoriaNombre = text(item.subcategoria, "Sin clasificar");
  const unidadNombre = text(item.unidad, "unidad");
  const tipoNombre = "Material";
  const codigo = text(item.codigo, `${slug(nombre)}-${String(index + 1).padStart(4, "0")}`);

  const categoria = await oneByName(supabase, "elankav_catalogo_categorias", categoriaNombre, {
    codigo: slug(categoriaNombre, "EMC-CAT"),
    activo: true,
  });

  let { data: subcategoria, error: subError } = await supabase
    .from("elankav_catalogo_subcategorias")
    .select("*")
    .eq("nombre", subcategoriaNombre)
    .eq("categoria_id", categoria.id)
    .maybeSingle();

  if (subError) throw subError;

  if (!subcategoria) {
    const created = await supabase
      .from("elankav_catalogo_subcategorias")
      .insert({
        codigo: slug(`${categoriaNombre}-${subcategoriaNombre}`, "EMC-SUB"),
        nombre: subcategoriaNombre,
        categoria_id: categoria.id,
        activo: true,
      })
      .select()
      .single();

    if (created.error) throw created.error;
    subcategoria = created.data;
  }

  const unidad = await oneByName(supabase, "elankav_catalogo_unidades", unidadNombre);
  const tipo = await oneByName(supabase, "elankav_catalogo_tipos_item", tipoNombre, {
    codigo: "EMC-TIPO-MATERIAL",
    activo: true,
  });

  let marca = null;
  if (text(item.marca)) {
    marca = await oneByName(supabase, "elankav_catalogo_marcas", item.marca);
  }

  let { data: catalogItem, error: itemError } = await supabase
    .from("elankav_catalogo_items")
    .select("*")
    .eq("codigo", codigo)
    .maybeSingle();

  if (itemError) throw itemError;

  const payloadItem = {
    codigo,
    nombre,
    descripcion: text(item.descripcion || item.nombre, nombre),
    categoria_id: categoria.id,
    subcategoria_id: subcategoria.id,
    tipo_item_id: tipo.id,
    unidad_base_id: unidad.id,
    medida_texto: text(item.unidad),
    unidad_calculo: text(item.unidad, "unidad").toUpperCase(),
    uso: "COMPRA",
    es_compartido: true,
    estado: "ACTIVO",
    activo: true,
  };

  if (!catalogItem) {
    const created = await supabase
      .from("elankav_catalogo_items")
      .insert(payloadItem)
      .select()
      .single();

    if (created.error) throw created.error;
    catalogItem = created.data;
  } else {
    const updated = await supabase
      .from("elankav_catalogo_items")
      .update(payloadItem)
      .eq("id", catalogItem.id)
      .select()
      .single();

    if (updated.error) throw updated.error;
    catalogItem = updated.data;
  }

  return { catalogItem, unidad, marca, codigo, nombre };
}

async function guardarProveedorItem({ supabase, proveedor, item, pagina, index }) {
  const base = await crearBaseCatalogo({ supabase, item, index });
  const precio = num(item.precio, 0);
  const iva = 15;
  const precioFinal = precio > 0 ? Number((precio * (1 + iva / 100)).toFixed(2)) : 0;

  const payload = {
    proveedor_id: proveedor.id,
    item_id: base.catalogItem.id,
    marca_id: base.marca?.id || null,
    unidad_compra_id: base.unidad.id,
    codigo_catalogo: base.codigo,
    nombre_catalogo: base.nombre,
    presentacion: text(item.unidad || item.presentacion, "unidad"),
    precio_lista: precio,
    incluye_iva: false,
    iva_porcentaje: iva,
    precio_final: precioFinal,
    precio_confirmado: false,
    estado_informacion: precio > 0 ? "COMPLETO" : "SIN_PRECIO",
    usar_presupuesto: false,
    prioridad_compra: 1,
    unidades_por_presentacion: 1,
    costo_unitario: precio,
    ultima_verificacion: new Date().toISOString().slice(0, 10),
    activo: true,
    observaciones: text(item.linea_original || item.descripcion || item.nombre),
  };

  const existing = await supabase
    .from("elankav_catalogo_proveedor_items")
    .select("*")
    .eq("proveedor_id", proveedor.id)
    .eq("codigo_catalogo", base.codigo)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const updated = await supabase
      .from("elankav_catalogo_proveedor_items")
      .update(payload)
      .eq("id", existing.data.id)
      .select()
      .single();

    if (updated.error) throw updated.error;
    return updated.data;
  }

  const inserted = await supabase
    .from("elankav_catalogo_proveedor_items")
    .insert(payload)
    .select()
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function savePageItems({ proveedor, items = [], archivo = {}, pagina = 1 } = {}) {
  if (!proveedor?.id) {
    return { ok: false, guardado: false, error: "Falta proveedor.id para guardar EMC." };
  }

  if (!Array.isArray(items) || !items.length) {
    return { ok: true, guardado: false, razon: "sin_items", pagina, total: 0 };
  }

  const supabase = createSupabaseServerClient();
  const guardados = [];
  const errores = [];

  for (let index = 0; index < items.length; index += 1) {
    try {
      const row = await guardarProveedorItem({
        supabase,
        proveedor,
        item: items[index],
        archivo,
        pagina,
        index,
      });

      guardados.push(row);
    } catch (error) {
      errores.push({
        index,
        item: items[index]?.nombre || items[index]?.descripcion || "Producto EMC",
        error: error.message,
      });
    }
  }

  return {
    ok: errores.length === 0,
    guardado: guardados.length > 0,
    pagina,
    total: items.length,
    guardados: guardados.length,
    errores,
    table: "elankav_catalogo_proveedor_items",
    ids: guardados.map((row) => row.id).filter(Boolean),
  };
}

export default {
  savePageItems,
};
