// =============================================================================
// /admin/eventos — Hub de Eventos
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • masterOnly: redireciona se role !== 'master'
// =============================================================================

import { redirect }    from 'next/navigation'
import { requireAdmin } from '@/lib/supabase/admin'
import { AdminShell }  from '../_AdminShell'
import { C }           from '@/app/components/ui'

export default async function AdminEventosPage() {
  const session = await requireAdmin()

  // masterOnly — não liberar para unit_admin ainda
  if (session.role !== 'master') redirect('/admin')

  const EVENTS = [
    {
      key:         'gauchinho_construtora',
      title:       'Gauchinho × Construtora',
      description: 'Evento de captação para análise de apartamentos. Leads com interesse em financiamento, consórcio, carta contemplada e Plano Pontual.',
      emoji:       '🏗️',
      href:        '/admin/eventos/gauchinho',
      status:      'active' as const,
      color:       '#1B4F8A',
      colorBg:     '#EBF2FA',
    },
  ]

  return (
    <AdminShell session={session} title="Eventos">

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          📅 Eventos
        </h1>
        <p style={{ fontSize: 12, color: C.textSec, margin: '4px 0 0' }}>
          Leads capturados em eventos de parceiros. Separados dos leads normais do DNA Financeiro.
        </p>
      </div>

      {/* ── Aviso de isolamento ── */}
      <div style={{
        background: C.amberBg, borderRadius: 12,
        border: `1px solid ${C.amber}30`,
        padding: '12px 14px', marginBottom: 24,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 12, color: C.amberDark, lineHeight: 1.6 }}>
          <strong>Estes leads são independentes</strong> dos leads normais do DNA Financeiro.
          Não aparecem em /admin/leads. A exportação Excel filtra apenas leads com consentimento
          de compartilhamento com a construtora (<code>consent_share_builder = true</code>).
        </p>
      </div>

      {/* ── Lista de eventos ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {EVENTS.map(ev => (
          <a
            key={ev.key}
            href={ev.href}
            style={{
              display: 'block', textDecoration: 'none',
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`,
              padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'box-shadow .15s',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* Ícone */}
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: ev.colorBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                {ev.emoji}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ev.title}</span>
                  <span style={{
                    background: ev.status === 'active' ? C.greenBg : C.bgSecondary,
                    color: ev.status === 'active' ? C.greenDark : C.textSec,
                    fontSize: 9, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>
                    {ev.status === 'active' ? '● Ativo' : 'Inativo'}
                  </span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
                  {ev.description}
                </p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: ev.color, fontWeight: 600,
                }}>
                  Ver leads →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

    </AdminShell>
  )
}
