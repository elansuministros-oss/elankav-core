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
  if (!supabase) {
    return {
      version: "AI-09.1",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: { supabase: "no_configurado" },
      errores_fuentes: {},
      fuentes: {},
      reglas: [
        "No inventar precios.",
        "No inventar materiales.",
        "No inventar proveedores.",
        "Si no hay memoria disponible, indicar pendiente de validación."
      ]
    };
  }

  const { data, error } = await supabase.rpc("elankav_memoria_operativa");

  if (error) {
    return {
      version: "AI-09.1",
      unidad,
      entrada_usuario: entradaUsuario,
      estado_fuentes: {
        supabase: "error",
        rpc: "error"
      },
      errores_fuentes: {
        rpc: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      },
      fuentes: {},
      reglas: [
        "No inventar precios.",
        "No inventar materiales.",
        "No inventar proveedores.",
        "Si no hay memoria disponible, indicar pendiente de validación."
      ]
    };
  }

  const memoria = data || {};

  return {
    version: "AI-09.1",
    unidad,
    entrada_usuario: entradaUsuario,
    estado_fuentes: {
      supabase: "conectado",
      rpc: "ok",
      materiales_ia_v2: Array.isArray(memoria.materiales_ia_v2) ? "ok" : "vacio",
      materiales_master_v2: Array.isArray(memoria.materiales_master_v2) ? "ok" : "vacio",
      tintas_master: Array.isArray(memoria.tintas_master) ? "ok" : "vacio",
      biblioteca_tecnica: Array.isArray(memoria.biblioteca_tecnica) ? "ok" : "vacio",
      biblioteca_componentes: Array.isArray(memoria.biblioteca_componentes) ? "ok" : "vacio",
      tecnologias_impresion: Array.isArray(memoria.tecnologias_impresion) ? "ok" : "vacio",
      proveedores: Array.isArray(memoria.proveedores) ? "ok" : "vacio"
    },
    errores_fuentes: {},
    fuentes: {
      materiales_ia_v2: compactarArray(memoria.materiales_ia_v2),
      materiales_master_v2: compactarArray(memoria.materiales_master_v2),
      tintas_master: compactarArray(memoria.tintas_master),
      biblioteca_tecnica: compactarArray(memoria.biblioteca_tecnica),
      biblioteca_componentes: compactarArray(memoria.biblioteca_componentes),
      tecnologias_impresion: compactarArray(memoria.tecnologias_impresion),
      proveedores: compactarArray(memoria.proveedores)
    },
    reglas: [
      "Fuente principal de precios: materiales_master_v2.",
      "materiales_ia_v2 solo sirve como índice auxiliar de nombres; no usarlo para precios si materiales_master_v2 tiene datos.",
      "No inventar precios.",
      "No inventar materiales.",
      "No inventar proveedores.",
      "No inventar recetas constructivas.",
      "Si existe precio_venta_1x, precio_venta_1_5x, precio_venta_2x, costo_m2_material o costo_con_tinta, usarlo para calcular.",
      "Para precio comercial preliminar usar preferentemente precio_venta_1x.",
      "Para costos internos usar costo_con_tinta o costo_m2_material según aplique.",
      "Para lonas, viniles o impresión por área: área = ancho x alto.",
      "Para ojetes cada 50 cm: calcular sobre perímetro. Perímetro = (ancho + alto) x 2.",
      "Cantidad de ojetes aproximada = perímetro / separación.",
      "Si no existe precio oficial de accesorio, marcar pendiente de validación."
    ]
  };
}
