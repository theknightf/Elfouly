import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://bhdxlmusufwwioghahec.supabase.co';

const supabaseKey =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_9FM2lJPZNQk7ur8A0glUdg_54MA2wHZ';

export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    realtime: {
      params: {
        eventsPerSecond: 20
      }
    }
  });
}

export const supabase = createSupabaseClient();
