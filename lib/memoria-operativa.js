import { createClient } from "@supabase/supabase-js";

export function crearClienteSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function compactarRegistro(registro = {}) {
  const salida = {};

  for (const [key, value] of Object.entries(registro || {})) {
    if (value === null || value === undefined || value === "") continue;
    salida[key] = typeof value === "string" ? value.slice(0, 240) : value;
  }

  return salida;
}

export function compactarArray(valor) {
  return Array.isArray(valor) ? valor.map(compactarRegistro) : [];
}

export async function obtenerMemoriaOperativa({
  supabase = null,
  entradaUsuario = "",
  unidad = "ELANVISUAL"
} = {}) {
  const reglasAI23 = [
    "AI-23 es la única fuente oficial de costos para funciones cubiertas por el Centro de Costos.",
    "ELAN AI no debe calcular costos manualmente.",
    "ELAN AI no debe usar materiales_master_v2, materiales_ia_v2 ni perfiles embebidos como fuente de precios.",
    "ELAN AI debe consumir costos exclusivamente mediante lib/ai23/index.js.",
    "Las respuestas de costos deben mostrar USD, C$ y tipo de cambio cuando corresponda.",
    "Si AI-23 no puede calcular, indicar pendiente de validación en Centro de Costos."
  ];

  if (!supabase) {
    return {
      version: "AI-23-P06",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: { supabase: "no_configurado", costos: "ai23_obligatorio" },
      errores_fuentes: {},
      fuentes: {},
      reglas: reglasAI23
    };
  }

  const { data, error } = await supabase.rpc("elankav_memoria_operativa");

  if (error) {
    return {
      version: "AI-23-P06",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: {
        supabase: "error",
        rpc: "error",
        costos: "ai23_obligatorio"
      },
      errores_fuentes: {
        rpc: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      },
      fuentes: {},
      reglas: reglasAI23
    };
  }

  const memoria = data || {};

  return {
    version: "AI-23-P06",
    unidad,
    entrada_usuario: entradaUsuario,
    estado_fuentes: {
      supabase: "conectado",
      rpc: "ok",
      costos: "ai23_obligatorio",
      biblioteca_tecnica: Array.isArray(memoria.biblioteca_tecnica) ? "ok" : "vacio",
      biblioteca_componentes: Array.isArray(memoria.biblioteca_componentes) ? "ok" : "vacio",
      tecnologias_impresion: Array.isArray(memoria.tecnologias_impresion) ? "ok" : "vacio",
      proveedores: Array.isArray(memoria.proveedores) ? "ok" : "vacio"
    },
    errores_fuentes: {},
    fuentes: {
      biblioteca_tecnica: compactarArray(memoria.biblioteca_tecnica),
      biblioteca_componentes: compactarArray(memoria.biblioteca_componentes),
      tecnologias_impresion: compactarArray(memoria.tecnologias_impresion),
      proveedores: compactarArray(memoria.proveedores)
    },
    reglas: reglasAI23
  };
}
'@ | Set-Content .\lib\memoria-operativa.js -Encoding UTF8
