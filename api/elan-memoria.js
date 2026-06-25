import {
  crearClienteSupabase,
  obtenerMemoriaOperativa
} from "../lib/memoria-operativa.js";

const supabase = crearClienteSupabase();

export default async function handler(req, res) {
  try {
    const memoria = await obtenerMemoriaOperativa({
      supabase,
      entradaUsuario: "",
      unidad: "ELANVISUAL"
    });

    const fuentes = memoria.fuentes || {};

    const conteos = {
      materiales_ia_v2: fuentes.materiales_ia_v2?.length || 0,
      materiales_master_v2: fuentes.materiales_master_v2?.length || 0,
      tintas_master: fuentes.tintas_master?.length || 0,
      biblioteca_tecnica: fuentes.biblioteca_tecnica?.length || 0,
      biblioteca_componentes: fuentes.biblioteca_componentes?.length || 0,
      tecnologias_impresion: fuentes.tecnologias_impresion?.length || 0,
      proveedores: fuentes.proveedores?.length || 0
    };

    const resultados = {
      materiales_ia_v2: fuentes.materiales_ia_v2?.slice(0, 5) || [],
      materiales_master_v2: fuentes.materiales_master_v2?.slice(0, 5) || [],
      tintas_master: fuentes.tintas_master?.slice(0, 5) || [],
      biblioteca_tecnica: fuentes.biblioteca_tecnica?.slice(0, 5) || [],
      biblioteca_componentes: fuentes.biblioteca_componentes?.slice(0, 5) || [],
      tecnologias_impresion: fuentes.tecnologias_impresion?.slice(0, 5) || [],
      proveedores: fuentes.proveedores?.slice(0, 5) || []
    };

    return res.status(memoria.estado_fuentes?.supabase === "error" ? 500 : 200).json({
      ok: memoria.estado_fuentes?.supabase !== "error",
      endpoint: "/api/elan-memoria",
      version: memoria.version,
      metodo: "memoria_operativa_unificada",
      rpc: "elankav_memoria_operativa",
      supabase_url: process.env.SUPABASE_URL,
      estado_fuentes: memoria.estado_fuentes,
      errores_fuentes: memoria.errores_fuentes,
      conteos,
      resultados
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      endpoint: "/api/elan-memoria",
      error: error?.message || "Error inesperado"
    });
  }
}
