// =============================================================================
// /admin/login — Página de login do painel admin
//
// Fluxo:
//   • Se já tem cookie dna_admin_token válido → redireciona para /admin/oportunidades
//   • Caso contrário → exibe formulário de login (email + senha)
//   • A Server Action loginAdmin autentica via Supabase e seta cookie HttpOnly
// =============================================================================

import { cookies }    from 'next/headers'
import { redirect }   from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LoginForm }  from './LoginForm'
import { C }          from '@/app/components/ui'

export default async function AdminLoginPage() {
  // Se já está autenticado, redireciona diretamente
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_admin_token')?.value
  if (token) {
    try {
      const svc = createServerSupabaseClient()
      const { data: { user } } = await svc.auth.getUser(token)
      if (user) redirect('/admin/oportunidades')
    } catch { /* token inválido, exibir login normalmente */ }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: C.bgApp,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
            fontSize: 26, marginBottom: 14,
          }}>🧬</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
            DNA Financeiro
          </h1>
          <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
            Painel administrativo
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 20,
          border: `0.5px solid ${C.border}`,
          padding: '28px 24px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>
            Acesso restrito
          </h2>
          <LoginForm />
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 16 }}>
          🔒 Acesso exclusivo para consultores e administradores
        </p>
      </div>
    </div>
  )
}
