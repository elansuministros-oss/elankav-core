import { createClient } from "@supabase/supabase-js";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: "Supabase no configurado",
      });
    }

    const { data, error } = await supabase
      .from("pedidos")
      .select("id,estado,created_at")
      .limit(5);

    if (error) {
      return res.status(500).json({
        ok: false,
        fuente: "pedidos",
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    return res.status(200).json({
      ok: true,
      endpoint: "/api/elan-memoria",
      supabase: "conectado",
      prueba_pedidos: data || [],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado",
    });
  }
}