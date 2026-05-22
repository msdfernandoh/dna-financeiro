// =============================================================================
// DNA FINANCEIRO — SUPABASE HELPERS ADMIN
//
// SEGURANÇA:
//   • requireAdmin(): lê cookie dna_admin_token (HttpOnly) e verifica JWT
//     via serviceClient.auth.getUser() — nunca confia em dados do browser
//   • createAnonSupabaseClient(): usa anon key server-side apenas para login
//   • Roles aceitas: 'master' | 'unit_admin' | 'unit_viewer'
//   • Perfis inativos (active=false) ou deletados são rejeitados
// =============================================================================

import { cookies }   from 'next/headers'
import { redirect }  from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from './server'

export interface AdminSession {
  userId:    string
  profileId: string
  role:      'master' | 'unit_admin' | 'unit_viewer'
  unitId:    string | null
  name:      string
  email:     string
}

/**
 * Cria um cliente Supabase com a ANON key.
 * Usado SOMENTE no servidor para signInWithPassword.
 * A anon key NÃO é exposta ao browser — chamada apenas em Server Actions.
 */
export function createAnonSupabaseClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Verifica o cookie dna_admin_token e retorna a sessão admin.
 * Redireciona para /admin/login se não autenticado ou sem permissão.
 *
 * Fluxo:
 *   1. Lê cookie dna_admin_token (access_token do Supabase)
 *   2. Verifica JWT via serviceClient.auth.getUser(token)
 *   3. Busca profile — valida role e active
 *   4. Retorna AdminSession com dados do perfil
 */
export async function requireAdmin(): Promise<AdminSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_admin_token')?.value
  if (!token) redirect('/admin/login')

  const serviceClient = createServerSupabaseClient()

  // Verifica JWT via service_role — não depende de sessão persistida
  const { data: { user }, error: userError } = await serviceClient.auth.getUser(token)
  if (userError || !user) redirect('/admin/login')

  // Busca perfil com role e active
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, unit_id, name, email, role, active')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single()

  if (profileError || !profile) redirect('/admin/login')
  if (!profile.active)          redirect('/admin/login')

  const ALLOWED_ROLES = ['master', 'unit_admin', 'unit_viewer']
  if (!ALLOWED_ROLES.includes(profile.role)) redirect('/admin/login')

  return {
    userId:    user.id,
    profileId: profile.id,
    role:      profile.role as AdminSession['role'],
    unitId:    profile.unit_id ?? null,
    name:      profile.name,
    email:     profile.email,
  }
}
