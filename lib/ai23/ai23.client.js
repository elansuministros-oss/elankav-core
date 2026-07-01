import { createClient } from "@supabase/supabase-js";

export function createAI23Client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error("AI23_SUPABASE_URL_MISSING");
  if (!key) throw new Error("AI23_SUPABASE_KEY_MISSING");

  return createClient(url, key);
}
