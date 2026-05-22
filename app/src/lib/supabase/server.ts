// =============================================================================
// DNA FINANCEIRO — CLIENTES SUPABASE
//
// DOIS clientes com propósitos distintos:
//
//   createServerClient()
//     Usa a SERVICE_ROLE key. Bypassa RLS completamente.
//     Usado APENAS no servidor (Route Handlers, Server Actions, Server Components).
//     NUNCA importar em Client Components.
//     Responsável por: inserir leads com unit_id, ler dados sensíveis.
//
//   createBrowserClient()  (exportado de lib/supabase/browser.ts)
//     Usa a ANON key. Respeita RLS.
//     Usado no browser para operações autenticadas (painel admin — MVP 2).
//
// =============================================================================

import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role key.
 * Bypassa RLS — use SOMENTE no servidor.
 * Valida as variáveis de ambiente em runtime (não em build).
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
