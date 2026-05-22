'use server'

// =============================================================================
// DNA FINANCEIRO — SERVER ACTIONS: LOGIN / LOGOUT ADMIN
//
// SEGURANÇA:
//   • signInWithPassword roda server-side com anon key (não exposta ao browser)
//   • access_token armazenado em cookie HttpOnly, SameSite=Lax
//   • logoutAdmin apenas limpa o cookie — não mantém sessão Supabase no server
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createAnonSupabaseClient } from '@/lib/supabase/admin'

// ── Login ─────────────────────────────────────────────────────────────────────

export type LoginResult =
  | { success: true }
  | { success: false; error: string }

export async function loginAdmin(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const email    = formData.get('email')?.toString().trim()    ?? ''
  const password = formData.get('password')?.toString()        ?? ''

  if (!email || !password) {
    return { success: false, error: 'Informe e-mail e senha.' }
  }

  let accessToken: string
  try {
    const anonClient = createAnonSupabaseClient()
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password })

    if (error || !data?.session?.access_token) {
      return { success: false, error: 'E-mail ou senha incorretos.' }
    }
    accessToken = data.session.access_token
  } catch {
    return { success: false, error: 'Erro ao conectar. Tente novamente.' }
  }

  // Armazena access_token em cookie HttpOnly — 1 hora
  const cookieStore = await cookies()
  cookieStore.set('dna_admin_token', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60,  // 1 hora
    path:     '/',
  })

  redirect('/admin/oportunidades')
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.set('dna_admin_token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  })
  redirect('/admin/login')
}
