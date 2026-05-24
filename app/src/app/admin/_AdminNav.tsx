'use client'

// =============================================================================
// Nav lateral/horizontal do admin — Client Component (usa usePathname)
// =============================================================================

import { usePathname } from 'next/navigation'
import { C } from '@/app/components/ui'

const NAV_ITEMS = [
  { href: '/admin/oportunidades', label: 'Oportunidades', emoji: '🎯', available: true  },
  { href: '/admin/leads',         label: 'Leads',         emoji: '👥', available: false },
  { href: '/admin/perguntas',     label: 'Perguntas',     emoji: '❓', available: false },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <>
      {NAV_ITEMS.map(item => {
        const isActive = pathname.startsWith(item.href)

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
