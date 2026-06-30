function assertRes(res, paso) {
  if (res.error) throw new Error(`${paso}: ${res.error.message}`);
  return res.data;
}

function limpio(valor, fallback) {
  const v = String(valor || "").trim();
  return v || fallback;
}

function estadoTexto(valor, fallback = "ACTIVO") {
  return String(valor || fallback).trim().toUpperCase();
}

async function buscarOCrearPorNombre(supabase, tabla, nombre, extra = {}) {
  let { data, error } = await supabase
    .from(tabla)
    .select("*")
    .eq("nombre", nombre)
    .maybeSingle();

  if (error) throw new Error(`${tabla}: ${error.message}`);

  if (!data) {
    data = assertRes(
      await supabase
        .from(tabla)
        .insert({ nombre, ...extra })
        .select()
        .single(),
      `Crear ${tabla}`
    );
  }

  return data;
}

export async function guardarEMC(body, supabase) {
  const items = Array.isArray(body.items) ? body.items : [];
  const proveedor = body.proveedor || null;

  const resultado = {
    ok: true,
    creados: 0,
    actualizados: 0,
    precios_creados: 0,
    precios_actualizados: 0,
    errores: [],
  };

  for (const item of items) {
    try {
      const categoriaNombre = limpio(item.categoria_sugerida, "General");
      const subcategoriaNombre = limpio(item.subcategoria_sugerida, "Sin clasificar");
      const unidadNombre = limpio(item.unidad_sugerida, "unidad");
      const tipoItemNombre = limpio(item.tipo_item_sugerido, "Material");
      const marcaNombre = limpio(item.marca_sugerida, "");

      const codigo = limpio(item.codigo, `EMC-${Date.now()}-${resultado.creados + resultado.actualizados + 1}`);
      const nombre = limpio(item.nombre, codigo);
      const descripcion = limpio(item.descripcion_original, nombre);
      const medidaTexto = item.medida_detectada?.texto || null;
      const precio = Number(item.precio_detectado || 0);
      const incluyeIva = item.iva_detectado?.incluido === true;
      const ivaPorcentaje = Number(item.iva_detectado?.porcentaje || 15);
      const proveedor_id = proveedor?.id || item.proveedor_id || null;

      const categoria = await buscarOCrearPorNombre(supabase, "elankav_catalogo_categorias", categoriaNombre);

      let { data: subcategoria, error: subError } = await supabase
        .from("elankav_catalogo_subcategorias")
        .select("*")
        .eq("nombre", subcategoriaNombre)
        .eq("categoria_id", categoria.id)
        .maybeSingle();

      if (subError) throw new Error(`Subcategoría: ${subError.message}`);

      if (!subcategoria) {
        subcategoria = assertRes(
          await supabase
            .from("elankav_catalogo_subcategorias")
            .insert({ nombre: subcategoriaNombre, categoria_id: categoria.id })
            .select()
            .single(),
          "Crear subcategoría"
        );
      }

      const unidad = await buscarOCrearPorNombre(supabase, "elankav_catalogo_unidades", unidadNombre);
      const tipoItem = await buscarOCrearPorNombre(supabase, "elankav_catalogo_tipos_item", tipoItemNombre);

      let marca = null;
      if (marcaNombre) {
        marca = await buscarOCrearPorNombre(supabase, "elankav_catalogo_marcas", marcaNombre);
      }

      let { data: existing, error: itemError } = await supabase
        .from("elankav_catalogo_items")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (itemError) throw new Error(`Buscar item: ${itemError.message}`);

      const payloadItem = {
        codigo,
        nombre,
        categoria_id: categoria.id,
        subcategoria_id: subcategoria.id,
        tipo_item_id: tipoItem.id,
        unidad_base_id: unidad.id,
        descripcion,
        medida_texto: medidaTexto,
        unidad_calculo: estadoTexto(unidadNombre, "UNIDAD"),
        uso: "COMPRA",
        es_compartido: true,
        estado: "ACTIVO",
        activo: true,
      };

      let item_id;

      if (!existing) {
        const nuevo = assertRes(
          await supabase.from("elankav_catalogo_items").insert(payloadItem).select().single(),
          "Crear item"
        );
        item_id = nuevo.id;
        resultado.creados++;
      } else {
        const actualizado = assertRes(
          await supabase.from("elankav_catalogo_items").update(payloadItem).eq("id", existing.id).select().single(),
          "Actualizar item"
        );
        item_id = actualizado.id;
        resultado.actualizados++;
      }

      if (proveedor_id) {
        const { data: proveedorItem, error: piError } = await supabase
          .from("elankav_catalogo_proveedor_items")
          .select("*")
          .eq("item_id", item_id)
          .eq("proveedor_id", proveedor_id)
          .maybeSingle();

        if (piError) throw new Error(`Buscar proveedor item: ${piError.message}`);

        const payloadProveedorItem = {
          item_id,
          proveedor_id,
          marca_id: marca?.id || null,
          unidad_compra_id: unidad.id,
          codigo_catalogo: codigo,
          nombre_catalogo: nombre,
          presentacion: medidaTexto || unidadNombre,
          precio_lista: precio,
          incluye_iva: incluyeIva,
          iva_porcentaje: ivaPorcentaje,
          precio_final: precio,
          precio_confirmado: false,
          estado_informacion: "IMPORTADO_EMC",
          usar_presupuesto: false,
          prioridad_compra: 1,
          unidades_por_presentacion: 1,
          costo_unitario: precio,
          ultima_verificacion: new Date().toISOString().slice(0, 10),
          activo: true,
          observaciones: descripcion,
        };

        if (proveedorItem) {
          assertRes(
            await supabase.from("elankav_catalogo_proveedor_items").update(payloadProveedorItem).eq("id", proveedorItem.id).select().single(),
            "Actualizar precio proveedor"
          );
          resultado.precios_actualizados++;
        } else {
          assertRes(
            await supabase.from("elankav_catalogo_proveedor_items").insert(payloadProveedorItem).select().single(),
            "Crear precio proveedor"
          );
          resultado.precios_creados++;
        }
      }
    } catch (error) {
      resultado.ok = false;
      resultado.errores.push({
        item: item.codigo || item.nombre || "sin_codigo",
        error: error.message,
      });
    }
  }

  return resultado;
}
