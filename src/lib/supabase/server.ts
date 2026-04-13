import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function createSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // Return a dummy client during build time
    // This will throw at runtime if env vars are not set
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      console.warn('Supabase env vars not set — some features will not work');
    }
    return createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseServiceKey || 'placeholder-key',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = createSupabaseAdmin();
