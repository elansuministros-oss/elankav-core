function assertRes(res, paso) {
  if (res.error) throw new Error(`${paso}: ${res.error.message}`);
  return res.data;
}

function limpio(valor, fallback) {
  const v = String(valor || "").trim();
  return v || fallback;
}

export async function guardarEMC(body, supabase) {
  const items = Array.isArray(body.items) ? body.items : [];
  const proveedor = body.proveedor || null;

  const resultado = {
    ok: true,
    creados: 0,
    actualizados: 0,
    errores: [],
  };

  for (const item of items) {
    try {
      const categoriaNombre = limpio(item.categoria_sugerida, "General");
      const subcategoriaNombre = limpio(item.subcategoria_sugerida, "Sin clasificar");
      const unidadNombre = limpio(item.unidad_sugerida, "unidad");
      const codigo = limpio(item.codigo, `EMC-${Date.now()}-${resultado.creados + resultado.actualizados + 1}`);
      const nombre = limpio(item.nombre, codigo);
      const descripcion = limpio(item.descripcion_original, nombre);
      const medidaTexto = item.medida_detectada?.texto || null;
      const precio = Number(item.precio_detectado || 0);
      const moneda = item.moneda_sugerida || "USD";
      const proveedor_id = proveedor?.id || null;

      let { data: categoria, error: catError } = await supabase
        .from("elankav_catalogo_categorias")
        .select("*")
        .eq("nombre", categoriaNombre)
        .maybeSingle();

      if (catError) throw new Error(`Categoría: ${catError.message}`);

      if (!categoria) {
        categoria = assertRes(
          await supabase
            .from("elankav_catalogo_categorias")
            .insert({ nombre: categoriaNombre })
            .select()
            .single(),
          "Crear categoría"
        );
      }

      let { data: subcategoria, error: subError } = await supabase
        .from("elankav_catalogo_subcategorias")
        .select("*")
        .eq("nombre", subcategoriaNombre)
        .maybeSingle();

      if (subError) throw new Error(`Subcategoría: ${subError.message}`);

      if (!subcategoria) {
        subcategoria = assertRes(
          await supabase
            .from("elankav_catalogo_subcategorias")
            .insert({
              nombre: subcategoriaNombre,
              categoria_id: categoria.id,
            })
            .select()
            .single(),
          "Crear subcategoría"
        );
      }

      let { data: unidad, error: unidadError } = await supabase
        .from("elankav_catalogo_unidades")
        .select("*")
        .eq("nombre", unidadNombre)
        .maybeSingle();

      if (unidadError) throw new Error(`Unidad: ${unidadError.message}`);

      if (!unidad) {
        unidad = assertRes(
          await supabase
            .from("elankav_catalogo_unidades")
            .insert({ nombre: unidadNombre })
            .select()
            .single(),
          "Crear unidad"
        );
      }

      let { data: existing, error: itemError } = await supabase
        .from("elankav_catalogo_items")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (itemError) throw new Error(`Buscar item: ${itemError.message}`);

      let item_id;

      const payloadItem = {
        codigo,
        nombre,
        categoria_id: categoria.id,
        subcategoria_id: subcategoria.id,
        unidad_base_id: unidad.id,
        descripcion,
        medida_texto: medidaTexto,
        unidad_calculo: unidadNombre,
        estado: "activo",
        activo: true,
      };

      if (!existing) {
        const nuevo = assertRes(
          await supabase
            .from("elankav_catalogo_items")
            .insert(payloadItem)
            .select()
            .single(),
          "Crear item"
        );

        item_id = nuevo.id;
        resultado.creados++;
      } else {
        const actualizado = assertRes(
          await supabase
            .from("elankav_catalogo_items")
            .update(payloadItem)
            .eq("id", existing.id)
            .select()
            .single(),
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
          precio,
          moneda,
        };

        if (proveedorItem) {
          assertRes(
            await supabase
              .from("elankav_catalogo_proveedor_items")
              .update(payloadProveedorItem)
              .eq("id", proveedorItem.id)
              .select()
              .single(),
            "Actualizar precio proveedor"
          );
        } else {
          assertRes(
            await supabase
              .from("elankav_catalogo_proveedor_items")
              .insert(payloadProveedorItem)
              .select()
              .single(),
            "Crear precio proveedor"
          );
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