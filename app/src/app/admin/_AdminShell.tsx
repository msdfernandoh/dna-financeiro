// Componente de shell visual para todas as páginas do admin.
// Server Component — usa form com Server Action para logout.
// Arquivo prefixado com _ → Next.js não o trata como rota.

import type { ReactNode } from 'react'
import { logoutAdmin }   from '@/app/admin/login/actions'
import type { AdminSession } from '@/lib/supabase/admin'
import { C } from '@/app/components/ui'
import { AdminNav } from './_AdminNav'

const ROLE_LABEL: Record<AdminSession['role'], string> = {
  master:      'Master',
  unit_admin:  'Admin',
  unit_viewer: 'Visualizador',
}

interface Props {
  session:  AdminSession
  title:    string
  children: ReactNode
  back?:    { href: string; label: string }
}

export function AdminShell({ session, title, children, back }: Props) {
  return (
    <div style={{
      minHeight: '100dvh', background: C.bgApp,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        {/* ── Linha 1: Logo + título + usuário + logout ── */}
        <div style={{
          padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 12, height: 52,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>🧬</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>DNA Admin</span>
          </div>

          {/* Separador + título / breadcrumb */}
          <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />

          {back ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <a href={back.href} style={{
                fontSize: 12, color: C.textSec, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}>
                ← {back.label}
              </a>
              <span style={{ color: C.textTer, fontSize: 12 }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, minWidth: 0 }}>
              {title}
            </span>
          )}

          {/* Usuário + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                {session.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, color: C.textSec }}>
                {ROLE_LABEL[session.role]}
              </div>
            </div>
            <form action={logoutAdmin}>
              <button type="submit" style={{
                border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '4px 10px', fontSize: 11,
                cursor: 'pointer', background: '#fff', color: C.textSec,
                fontFamily: 'inherit',
              }}>
                Sair
              </button>
            </form>
          </div>
        </div>

        {/* ── Linha 2: Navegação ── */}
        <div style={{
          borderTop: `0.5px solid ${C.border}`,
          padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: 2,
          overflowX: 'auto', scrollbarWidth: 'none', height: 38,
        }}>
          <AdminNav role={session.role} />
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 60px' }}>
        {children}
      </main>
    </div>
  )
}
