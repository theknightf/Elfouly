import { createClient } from '@supabase/supabase-js';

// The project URL and publishable key come from the environment only (never from source code):
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY   (see .env.example)
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const nodeEnv = (typeof process !== 'undefined' && process.env) || {};

const supabaseUrl = viteEnv.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || '';
const supabaseKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  viteEnv.VITE_SUPABASE_ANON_KEY ||
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export function createSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    realtime: {
      params: {
        eventsPerSecond: 20
      }
    }
  });
}

// null when unconfigured, so importing this module can never crash the app.
export const supabase = isSupabaseConfigured ? createSupabaseClient() : null;
