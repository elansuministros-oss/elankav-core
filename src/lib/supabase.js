import { createClient } from '@supabase/supabase-js';

function cleanEnv(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
const supabaseKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

const urlValid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);
const keyValid = supabaseKey.length >= 80;

export const supabaseConfig = {
  ready: Boolean(supabaseUrl && supabaseKey && urlValid && keyValid),
  error: !supabaseUrl || !supabaseKey
    ? 'SUPABASE_PUBLIC_CONFIG_MISSING'
    : !urlValid
      ? 'SUPABASE_PUBLIC_URL_INVALID'
      : !keyValid
        ? 'SUPABASE_PUBLIC_KEY_INVALID'
        : null
};

export const supabase = supabaseConfig.ready
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;
