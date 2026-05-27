// =============================================================================
// /[unitSlug]/entrar — Acesso do lead por telefone
//
// Fluxo:
//   1. Valida que a unidade existe e está ativa
//   2. Se lead já tem cookie válido → redireciona para o painel
//   3. Exibe formulário de telefone
//   4. Server Action busca lead e recria o cookie
//   5. Redireciona para /[unitSlug]/painel
// =============================================================================

import { cookies }   from 'next/headers'
import { notFound }  from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { solicitarCodigo, verificarCodigo } from './actions'
import { EntrarForm }                       from './EntrarForm'
import { C }                 from '@/app/components/ui'
import { redirect }          from 'next/navigation'

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function EntrarPage({ params }: Props) {
  const { unitSlug } = await params
  const supabase     = createServerSupabaseClient()

  // Valida unidade
  const { data: unit } = await supabase
    .from('units')
    .select('id, name, city, state, logo_url, primary_color')
    .eq('slug', unitSlug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!unit) notFound()

  // Se já tem cookie válido → vai direto para o painel
  const cookieStore = await cookies()
  const token       = cookieStore.get('dna_lead_token')?.value
  if (token) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8')
      const leadId  = decoded.split(':')[0]
      if (leadId && /^[0-9a-f-]{36}$/.test(leadId)) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('id', leadId)
          .eq('unit_slug', unitSlug)
          .is('deleted_at', null)
          .single()
        if (lead) redirect(`/${unitSlug}/inicio`)
      }
    } catch { /* cookie inválido — exibe formulário normalmente */ }
  }

  const primary = unit.primary_color ? `#${unit.primary_color.replace('#', '')}` : C.purple

  // Bind do unitSlug em ambos os actions — nunca expostos ao browser
  const boundSolicitar = solicitarCodigo.bind(null, unitSlug)
  const boundVerificar = verificarCodigo.bind(null, unitSlug)

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.bgApp, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.purpleBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: primary }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{unit.city} · {unit.state}</div>
        </div>
      </header>

      <main style={{
        flex: 1, maxWidth: 420, width: '100%',
        margin: '0 auto', padding: '32px 20px 48px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>

        {/* Ícone */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 20,
            background: `linear-gradient(135deg, ${primary}, ${C.purpleDeep})`,
            fontSize: 30, marginBottom: 16,
          }}>📱</div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: C.text,
            margin: '0 0 6px', lineHeight: 1.2,
          }}>
            Bem-vindo de volta!
          </h1>
          <p style={{ fontSize: 13, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
            Informe seu telefone para acessar<br />seu painel e seus lançamentos.
          </p>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: '#fff', borderRadius: 20,
          border: `0.5px solid ${C.border}`,
          padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <EntrarForm
            solicitarAction={boundSolicitar}
            verificarAction={boundVerificar}
            unitSlug={unitSlug}
          />
        </div>

        {/* Link para cadastro */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 6px' }}>
            Ainda não tem cadastro?
          </p>
          <a href={`/${unitSlug}`} style={{
            fontSize: 13, color: primary, fontWeight: 600, textDecoration: 'none',
          }}>
            Fazer diagnóstico gratuito →
          </a>
        </div>

      </main>
    </div>
  )
}
