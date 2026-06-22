import { createClient } from "@supabase/supabase-js";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

async function probarTabla(nombre, select = "*", limite = 5) {
  try {
    const { data, error } = await supabase
      .from(nombre)
      .select(select)
      .limit(limite);

    if (error) {
      return {
        ok: false,
        tabla: nombre,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      };
    }

    return {
      ok: true,
      tabla: nombre,
      registros: data?.length || 0,
      muestra: data || [],
    };
  } catch (e) {
    return {
      ok: false,
      tabla: nombre,
      error: e.message,
    };
  }
}

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "Supabase no configurado",
      });
    }

    const resultados = await Promise.all([
      probarTabla("materiales_ia_v2", "id,nombre,estado", 3),
      probarTabla("materiales_master_v2", "id,nombre,estado", 3),
      probarTabla("tintas_master", "*", 3),
      probarTabla("biblioteca_tecnica", "*", 3),
      probarTabla("biblioteca_componentes", "*", 3),
      probarTabla("tecnologias_impresion", "*", 3),
      probarTabla("proveedores", "*", 3),
      probarTabla("pedidos", "id,estado,created_at", 3),
    ]);

    return res.status(200).json({
      ok: true,
      endpoint: "/api/elan-memoria",
      supabase_url: process.env.SUPABASE_URL,
      resultados,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado",
    });
  }
}