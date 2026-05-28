'use client'

// =============================================================================
// Nav horizontal do admin — Client Component (usa usePathname)
// Itens com masterOnly: true ficam ocultos para unit_admin e unit_viewer.
// =============================================================================

import { usePathname } from 'next/navigation'
import { C } from '@/app/components/ui'
import type { AdminSession } from '@/lib/supabase/admin'

const NAV_ITEMS = [
  { href: '/admin',               label: 'Dashboard',    emoji: '📊', available: true,  exact: true,  masterOnly: false },
  { href: '/admin/oportunidades', label: 'Oportunidades', emoji: '🎯', available: true,  exact: false, masterOnly: false },
  { href: '/admin/leads',         label: 'Leads',         emoji: '👥', available: true,  exact: false, masterOnly: false },
  { href: '/admin/eventos',                            label: 'Eventos',       emoji: '🏠', available: true,  exact: false, masterOnly: true  },
  { href: '/admin/unidades',                          label: 'Unidades',      emoji: '🏢', available: true,  exact: false, masterOnly: true  },
  { href: '/admin/usuarios',                          label: 'Usuários',      emoji: '👤', available: true,  exact: false, masterOnly: true  },
  { href: '/admin/configuracoes/caminhos-sonho',      label: 'Caminhos',      emoji: '⚙️', available: true,  exact: false, masterOnly: true  },
  { href: '/admin/eventos',                           label: 'Eventos',       emoji: '📅', available: true,  exact: false, masterOnly: true  },
  { href: '/admin/campanhas',     label: 'Campanhas',     emoji: '📣', available: false, exact: false, masterOnly: false },
  { href: '/admin/perguntas',     label: 'Perguntas',     emoji: '❓', available: false, exact: false, masterOnly: false },
  { href: '/admin/relatorios',    label: 'Relatórios',    emoji: '📋', available: false, exact: false, masterOnly: false },
] as const

interface Props { role: AdminSession['role'] }

export function AdminNav({ role }: Props) {
  const pathname = usePathname()

  return (
    <>
      {NAV_ITEMS.map(item => {
        if (item.masterOnly && role !== 'master') return null

        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)

        if (!item.available) {
          return (
            <span
              key={item.href}
              title="Em breve"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 99,
                fontSize: 12, color: C.textTer,
                cursor: 'not-allowed', whiteSpace: 'nowrap',
              }}
            >
              {item.emoji} {item.label}
              <span style={{
                background: C.bgSecondary, color: C.textTer,
                fontSize: 8, padding: '1px 5px', borderRadius: 99,
                letterSpacing: 0.3, fontWeight: 600,
              }}>EM BREVE</span>
            </span>
          )
        }

        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 99,
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              background: isActive ? C.purpleBg : 'transparent',
              color: isActive ? C.purpleDeep : C.textSec,
              textDecoration: 'none',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
              border: isActive ? `1.5px solid ${C.purple}30` : '1.5px solid transparent',
            }}
          >
            {item.emoji} {item.label}
          </a>
        )
      })}
    </>
  )
}
