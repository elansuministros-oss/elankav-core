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
      biblioteca_tecnica: fuentes.biblioteca_tecnica?.length || 0,
      biblioteca_componentes: fuentes.biblioteca_componentes?.length || 0,
      tecnologias_impresion: fuentes.tecnologias_impresion?.length || 0,
      proveedores: fuentes.proveedores?.length || 0
    };

    const resultados = {
      biblioteca_tecnica: fuentes.biblioteca_tecnica?.slice(0, 5) || [],
      biblioteca_componentes: fuentes.biblioteca_componentes?.slice(0, 5) || [],
      tecnologias_impresion: fuentes.tecnologias_impresion?.slice(0, 5) || [],
      proveedores: fuentes.proveedores?.slice(0, 5) || []
    };

    return res.status(memoria.estado_fuentes?.supabase === "error" ? 500 : 200).json({
      ok: memoria.estado_fuentes?.supabase !== "error",
      endpoint: "/api/elan-memoria",
      version: memoria.version,
      metodo: "memoria_operativa_ai23",
      costos: {
        fuente_oficial: "AI-23",
        fachada: "lib/ai23/index.js",
        nota: "Este endpoint no expone precios ni costos antiguos. Los cálculos cubiertos por AI-23 se resuelven por /api/elan-ai usando el motor de costos AI-23."
      },
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
'@ | Set-Content .\api\elan-memoria.js -Encoding UTF8
