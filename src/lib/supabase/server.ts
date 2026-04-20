import { createClient } from '@supabase/supabase-js';

/**
 * Cria um cliente Supabase Admin em runtime.
 * Chamado diretamente nas rotas para garantir que as env vars estejam disponíveis.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[Supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Alias para compatibilidade - usa getter que chama em runtime
export const supabaseAdmin = {
  from: (...args: Parameters<ReturnType<typeof getSupabaseAdmin>['from']>) =>
    getSupabaseAdmin().from(...args),
};
