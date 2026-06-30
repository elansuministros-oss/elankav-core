export async function guardarEMC(body, supabase) {
  const items = body.items || [];
  const proveedor = body.proveedor || null;

  const resultado = {
    ok: true,
    creados: 0,
    actualizados: 0,
    errores: []
  };

  for (const item of items) {
    try {

      // ======================
      // 1. CATEGORÍA
      // ======================
      let { data: categoria } = await supabase
        .from("elankav_catalogo_categorias")
        .select("*")
        .eq("nombre", item.categoria_sugerida)
        .maybeSingle();

      if (!categoria) {
        const res = await supabase
          .from("elankav_catalogo_categorias")
          .insert({ nombre: item.categoria_sugerida })
          .select()
          .single();

        categoria = res.data;
      }

      const categoria_id = categoria.id;

      // ======================
      // 2. SUBCATEGORÍA
      // ======================
      let { data: subcategoria } = await supabase
        .from("elankav_catalogo_subcategorias")
        .select("*")
        .eq("nombre", item.subcategoria_sugerida)
        .maybeSingle();

      if (!subcategoria) {
        const res = await supabase
          .from("elankav_catalogo_subcategorias")
          .insert({
            nombre: item.subcategoria_sugerida,
            categoria_id
          })
          .select()
          .single();

        subcategoria = res.data;
      }

      const subcategoria_id = subcategoria.id;

      // ======================
      // 3. MARCA
      // ======================
      let marca_id = null;

      if (item.marca_sugerida) {
        let { data: marca } = await supabase
          .from("elankav_catalogo_marcas")
          .select("*")
          .eq("nombre", item.marca_sugerida)
          .maybeSingle();

        if (!marca) {
          const res = await supabase
            .from("elankav_catalogo_marcas")
            .insert({ nombre: item.marca_sugerida })
            .select()
            .single();

          marca = res.data;
        }

        marca_id = marca.id;
      }

      // ======================
      // 4. UNIDAD
      // ======================
      let { data: unidad } = await supabase
        .from("elankav_catalogo_unidades")
        .select("*")
        .eq("nombre", item.unidad_sugerida)
        .maybeSingle();

      if (!unidad) {
        const res = await supabase
          .from("elankav_catalogo_unidades")
          .insert({ nombre: item.unidad_sugerida })
          .select()
          .single();

        unidad = res.data;
      }

      const unidad_id = unidad.id;

      // ======================
      // 5. PROVEEDOR (CORREGIDO)
      // ======================
      let proveedor_id = null;

      if (proveedor?.nombre || proveedor?.id) {

        if (proveedor.id) {
          proveedor_id = proveedor.id;
        } else {

          let { data: prov } = await supabase
            .from("elankav_catalogo_proveedores")
            .select("*")
            .eq("nombre", proveedor.nombre)
            .maybeSingle();

          if (!prov) {
            const res = await supabase
              .from("elankav_catalogo_proveedores")
              .insert({
                nombre: proveedor.nombre
              })
              .select()
              .single();

            prov = res.data;
          }

          proveedor_id = prov.id;
        }
      }

      // ======================
      // 6. ITEM
      // ======================
      let { data: existing } = await supabase
        .from("elankav_catalogo_items")
        .select("*")
        .eq("codigo", item.codigo)
        .maybeSingle();

      let item_id;

      if (!existing) {
        const res = await supabase
          .from("elankav_catalogo_items")
          .insert({
            codigo: item.codigo,
            nombre: item.nombre,
            categoria_id,
            subcategoria_id,
            marca_id,
            unidad_id
          })
          .select()
          .single();

        item_id = res.data.id;
        resultado.creados++;
      } else {
        item_id = existing.id;
        resultado.actualizados++;
      }

      // ======================
      // 7. PROVEEDOR ITEM
      // ======================
      await supabase
        .from("elankav_catalogo_proveedor_items")
        .upsert({
          item_id,
          proveedor_id,
          precio: item.precio_detectado || 0,
          moneda: item.moneda_sugerida || "USD"
        });

      // ======================
      // 8. HISTORIAL
      // ======================
      if (item.precio_detectado) {
        await supabase
          .from("elankav_catalogo_precios_hist")
          .insert({
            item_id,
            precio: item.precio_detectado,
            moneda: item.moneda_sugerida || "USD",
            proveedor_id,
            fecha: new Date().toISOString()
          });
      }

    } catch (error) {
      resultado.errores.push({
        item: item.codigo,
        error: error.message
      });
    }
  }

  return resultado;
}