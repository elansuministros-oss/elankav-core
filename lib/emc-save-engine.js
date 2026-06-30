function assertRes(res, paso) {
  if (res.error) {
    throw new Error(`${paso}: ${res.error.message}`);
  }
  return res.data;
}

function valorSeguro(valor, fallback) {
  const limpio = String(valor || "").trim();
  return limpio || fallback;
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
      const categoriaNombre = valorSeguro(item.categoria_sugerida, "General");
      const subcategoriaNombre = valorSeguro(item.subcategoria_sugerida, "Sin clasificar");
      const unidadNombre = valorSeguro(item.unidad_sugerida, "unidad");
      const codigo = valorSeguro(item.codigo, `EMC-${Date.now()}-${resultado.creados + resultado.actualizados + 1}`);
      const nombre = valorSeguro(item.nombre, codigo);

      let resCategoria = await supabase
        .from("elankav_catalogo_categorias")
        .select("*")
        .eq("nombre", categoriaNombre)
        .maybeSingle();

      if (resCategoria.error) throw new Error(`Categoría: ${resCategoria.error.message}`);

      let categoria = resCategoria.data;

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

      let resSubcategoria = await supabase
        .from("elankav_catalogo_subcategorias")
        .select("*")
        .eq("nombre", subcategoriaNombre)
        .maybeSingle();

      if (resSubcategoria.error) throw new Error(`Subcategoría: ${resSubcategoria.error.message}`);

      let subcategoria = resSubcategoria.data;

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

      let marca_id = null;

      if (item.marca_sugerida) {
        let resMarca = await supabase
          .from("elankav_catalogo_marcas")
          .select("*")
          .eq("nombre", item.marca_sugerida)
          .maybeSingle();

        if (resMarca.error) throw new Error(`Marca: ${resMarca.error.message}`);

        let marca = resMarca.data;

        if (!marca) {
          marca = assertRes(
            await supabase
              .from("elankav_catalogo_marcas")
              .insert({ nombre: item.marca_sugerida })
              .select()
              .single(),
            "Crear marca"
          );
        }

        marca_id = marca.id;
      }

      let resUnidad = await supabase
        .from("elankav_catalogo_unidades")
        .select("*")
        .eq("nombre", unidadNombre)
        .maybeSingle();

      if (resUnidad.error) throw new Error(`Unidad: ${resUnidad.error.message}`);

      let unidad = resUnidad.data;

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

      let proveedor_id = proveedor?.id || null;

      let resExisting = await supabase
        .from("elankav_catalogo_items")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();

      if (resExisting.error) throw new Error(`Buscar item: ${resExisting.error.message}`);

      let existing = resExisting.data;
      let item_id;

      if (!existing) {
        const nuevoItem = assertRes(
          await supabase
            .from("elankav_catalogo_items")
            .insert({
              codigo,
              nombre,
              categoria_id: categoria.id,
              subcategoria_id: subcategoria.id,
              marca_id,
              unidad_id: unidad.id,
              activo: true,
            })
            .select()
            .single(),
          "Crear item"
        );

        item_id = nuevoItem.id;
        resultado.creados++;
      } else {
        item_id = existing.id;

        assertRes(
          await supabase
            .from("elankav_catalogo_items")
            .update({
              nombre,
              categoria_id: categoria.id,
              subcategoria_id: subcategoria.id,
              marca_id,
              unidad_id: unidad.id,
            })
            .eq("id", item_id)
            .select()
            .single(),
          "Actualizar item"
        );

        resultado.actualizados++;
      }

      const precio = Number(item.precio_detectado || 0);

      await supabase
        .from("elankav_catalogo_proveedor_items")
        .upsert({
          item_id,
          proveedor_id,
          precio,
          moneda: item.moneda_sugerida || "USD",
        });

      if (precio > 0) {
        await supabase
          .from("elankav_catalogo_precios_hist")
          .insert({
            item_id,
            proveedor_id,
            precio,
            moneda: item.moneda_sugerida || "USD",
            fecha: new Date().toISOString(),
          });
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