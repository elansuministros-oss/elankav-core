import { createClient } from '@supabase/supabase-js';

function cleanEnv(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
const supabaseKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_PUBLIC_CONFIG_MISSING');
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error('SUPABASE_PUBLIC_URL_INVALID');
}

if (supabaseKey.length < 80) {
  throw new Error('SUPABASE_PUBLIC_KEY_INVALID');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
