import { createClient } from "@supabase/supabase-js";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

function compactarRegistro(registro = {}) {
  const salida = {};

  for (const [key, value] of Object.entries(registro || {})) {
    if (value === null || value === undefined || value === "") continue;

    salida[key] = typeof value === "string" ? value.slice(0, 240) : value;
  }

  return salida;
}

function compactarArray(valor) {
  return Array.isArray(valor) ? valor.map(compactarRegistro) : [];
}

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "Supabase no configurado"
      });
    }

    const { data, error } = await supabase.rpc(
      "elankav_memoria_operativa"
    );

    if (error) {
      return res.status(500).json({
        ok: false,
        endpoint: "/api/elan-memoria",
        metodo: "rpc_sin_argumentos",
        rpc: "elankav_memoria_operativa",
        supabase_url: process.env.SUPABASE_URL,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    }

    const memoria = data || {};

    const resultados = {
      materiales_ia_v2: compactarArray(memoria.materiales_ia_v2).slice(0, 5),
      materiales_master_v2: compactarArray(memoria.materiales_master_v2).slice(0, 5),
      tintas_master: compactarArray(memoria.tintas_master).slice(0, 5),
      biblioteca_tecnica: compactarArray(memoria.biblioteca_tecnica).slice(0, 5),
      biblioteca_componentes: compactarArray(memoria.biblioteca_componentes).slice(0, 5),
      tecnologias_impresion: compactarArray(memoria.tecnologias_impresion).slice(0, 5),
      proveedores: compactarArray(memoria.proveedores).slice(0, 5)
    };

    const conteos = {
      materiales_ia_v2: compactarArray(memoria.materiales_ia_v2).length,
      materiales_master_v2: compactarArray(memoria.materiales_master_v2).length,
      tintas_master: compactarArray(memoria.tintas_master).length,
      biblioteca_tecnica: compactarArray(memoria.biblioteca_tecnica).length,
      biblioteca_componentes: compactarArray(memoria.biblioteca_componentes).length,
      tecnologias_impresion: compactarArray(memoria.tecnologias_impresion).length,
      proveedores: compactarArray(memoria.proveedores).length
    };

    return res.status(200).json({
      ok: true,
      endpoint: "/api/elan-memoria",
      metodo: "rpc_sin_argumentos",
      rpc: "elankav_memoria_operativa",
      supabase_url: process.env.SUPABASE_URL,
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