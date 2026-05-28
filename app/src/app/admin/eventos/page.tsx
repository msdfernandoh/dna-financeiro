// =============================================================================
// /admin/eventos — Index de eventos disponíveis
// Acesso: master only
// =============================================================================

import { redirect }      from 'next/navigation'
import { requireAdmin }  from '@/lib/supabase/admin'
import { AdminShell }    from '../_AdminShell'
import { C }             from '@/app/components/ui'

export const metadata = { title: 'Eventos · Admin DNA Financeiro' }

export default async function AdminEventosPage() {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const EVENTS = [
    {
      key:         'gauchinho_construtora',
      name:        'Evento Construtora — Gauchinho',
      description: 'Captação de leads para pagamento de entrega/chaves de apartamento. Foco em consórcio, carta contemplada, financiamento e crédito.',
      emoji:       '🏠',
      status:      'active',
      href:        '/admin/eventos/gauchinho/leads',
      publicHref:  '/sinop/gauchinho/evento',
    },
  ]

  return (
    <AdminShell session={session} title="Eventos">

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          Eventos
        </h1>
        <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
          Captações de leads por evento externo
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {EVENTS.map(ev => (
          <div key={ev.key} style={{
            background: '#fff',
            borderRadius: 16,
            border: `0.5px solid ${C.border}`,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{ev.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ev.name}</span>
                    <span style={{
                      background: ev.status === 'active' ? C.greenBg : C.bgSecondary,
                      color: ev.status === 'active' ? C.greenDark : C.textSec,
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      textTransform: 'uppercase' as const, letterSpacing: 0.3,
                    }}>
                      {ev.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
                    {ev.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                <a
                  href={ev.href}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                    color: '#fff',
                    borderRadius: 10, padding: '8px 16px',
                    fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  👥 Ver leads
                </a>
                <a
                  href={ev.publicHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    border: `1px solid ${C.border}`,
                    color: C.textSec,
                    borderRadius: 10, padding: '8px 16px',
                    fontSize: 12, textDecoration: 'none', background: '#fff',
                  }}
                >
                  🔗 Ver página pública
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

    </AdminShell>
  )
}
