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

// Valida presença das variáveis em tempo de build/runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL não está definida. Verifique .env.local')
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY não está definida. Verifique .env.local')
}

/**
 * Cliente Supabase com service_role key.
 * Bypassa RLS — use SOMENTE no servidor.
 *
 * Não use este cliente em Client Components ou em código que roda no browser.
 * A service_role key deve ficar EXCLUSIVAMENTE em variáveis de servidor
 * (sem prefixo NEXT_PUBLIC_).
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      // Desabilita persistência de sessão no servidor
      // Cada chamada é stateless — correto para Route Handlers e Server Actions
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
