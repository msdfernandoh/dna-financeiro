'use client'

// =============================================================================
// LeadBottomNav — Navegação inferior fixa para o lead
//
// SEGURANÇA: componente puramente visual — nenhuma query, nenhum dado sensível.
// Usa apenas usePathname() para detectar a rota ativa.
// unitSlug vem do Server Component pai (nunca do browser diretamente).
//
// ONDE USAR: painel, despesas, investimentos, oportunidades, relatório, dna.
// NÃO USAR:  onboarding (/[unitSlug]), entrar, diagnostico.
// =============================================================================

import { usePathname } from 'next/navigation'
import { C } from '@/app/components/ui'

// ── Itens fixos de navegação ──────────────────────────────────────────────────

const NAV_BASE = [
  { key: 'inicio',        href: 'inicio',        emoji: '🏠', label: 'Início'    },
  { key: 'despesas',      href: 'despesas/nova', emoji: '💸', label: 'Despesas'  },
  { key: 'investimentos', href: 'investimentos', emoji: '💚', label: 'Investir'  },
  { key: 'oportunidades', href: 'oportunidades', emoji: '🎯', label: 'Oport.'   },
  { key: 'relatorio',     href: 'relatorio',     emoji: '📋', label: 'Relatório' },
] as const

const NAV_EMPRESA = { key: 'empresa', href: 'empresa', emoji: '🏢', label: 'Empresa' } as const

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  unitSlug:    string
  isBusiness?: boolean   // exibe item "Empresa" apenas para leads empresariais
}

// ── Componente ────────────────────────────────────────────────────────────────

export function LeadBottomNav({ unitSlug, isBusiness = false }: Props) {
  const pathname = usePathname()

  // Monta lista de itens dinamicamente — "Empresa" só para business leads
  const items = isBusiness
    ? [...NAV_BASE.slice(0, 4), NAV_EMPRESA, NAV_BASE[4]]
    : [...NAV_BASE]

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 100,
        background: '#fff',
        borderTop: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.07)',
        // Respeita safe-area do iOS (botão Home virtual)
        paddingBottom: 'env(safe-area-inset-bottom)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', maxWidth: 480, margin: '0 auto' }}>
        {items.map(item => {
          // Item ativo: a rota atual contém o segmento-chave
          const isActive = pathname.includes(`/${item.key}`)

          return (
            <a
              key={item.key}
              href={`/${unitSlug}/${item.href}`}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                textDecoration: 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '8px 2px 10px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Barra superior — indicador de ativo */}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28, height: 3,
                  background: C.purple,
                  borderRadius: '0 0 3px 3px',
                  display: 'block',
                }} />
              )}

              {/* Ícone com fundo pill quando ativo */}
              <span style={{
                width: 40, height: 27,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? C.purpleBg : 'transparent',
                borderRadius: 9,
                fontSize: 17,
                transition: 'background .15s',
              }}>
                {item.emoji}
              </span>

              {/* Label */}
              <span style={{
                fontSize: 9.5,
                lineHeight: 1.2,
                textAlign: 'center',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? C.purpleDeep : C.textTer,
                transition: 'color .15s',
              }}>
                {item.label}
              </span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
