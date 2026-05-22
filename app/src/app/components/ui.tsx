// Shared presentational primitives — no hooks, no server-only imports
// Safe to use in both Server Components and Client Components
import type { CSSProperties, ReactNode } from 'react'

// ── Design tokens ──────────────────────────────────────────────────────────────
export const C = {
  purple:      '#7F77DD',
  purpleDeep:  '#534AB7',
  purpleDark:  '#3C3489',
  purpleBg:    '#EEEDFE',
  green:       '#1D9E75',
  greenDark:   '#0F6E56',
  greenBg:     '#E1F5EE',
  amber:       '#EF9F27',
  amberDark:   '#854F0B',
  amberBg:     '#FAEEDA',
  coral:       '#D85A30',
  coralDark:   '#993C1D',
  coralBg:     '#FAECE7',
  bgApp:       '#F5F4FB',
  bgCard:      '#fff',
  bgSecondary: '#F0EFF9',
  border:      'rgba(0,0,0,0.08)',
  text:        '#1A1A2E',
  textSec:     '#888',
  textTer:     '#BBB',
} as const

// ── PublicShell ────────────────────────────────────────────────────────────────
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>
      {children}
    </div>
  )
}

// ── UnitHeader ─────────────────────────────────────────────────────────────────
export function UnitHeader({
  city, state: unitState, badge, primary = C.purple,
}: {
  city: string
  state?: string
  primary?: string
  badge?: { text: string; bg: string; color: string }
}) {
  return (
    <header style={{
      background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: C.purpleBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }}>🧬</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: primary }}>DNA Financeiro</div>
        <div style={{ fontSize: 11, color: C.textSec }}>
          {city}{unitState ? ` · ${unitState}` : ''}
        </div>
      </div>
      {badge && (
        <span style={{
          marginLeft: 'auto', background: badge.bg, color: badge.color,
          fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
        }}>{badge.text}</span>
      )}
    </header>
  )
}

// ── MiniStat ──────────────────────────────────────────────────────────────────
export function MiniStat({ label, value, valueColor = C.text }: {
  label: string; value: string; valueColor?: string
}) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.5)',
      borderRadius: 12, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 17, fontWeight: 500, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      background: bg, color,
    }}>{text}</span>
  )
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({
  value, color = C.purple, height = 8, style: extra,
}: {
  value: number; color?: string; height?: number; style?: CSSProperties
}) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 99, height, overflow: 'hidden', ...extra }}>
      <div style={{
        background: color, height: '100%', borderRadius: 99,
        width: `${Math.min(Math.max(value, 0), 100)}%`,
        transition: 'width 0.3s',
      }} />
    </div>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────
export function ActionButton({
  href, children, variant = 'primary', color = C.purple,
}: {
  href: string; children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline'
  color?: string
}) {
  const vs: Record<string, CSSProperties> = {
    primary:   { background: color, color: '#fff', border: 'none' },
    secondary: { background: C.purpleBg, color: C.purpleDeep, border: 'none' },
    outline:   { background: 'transparent', color, border: `1.5px solid ${color}` },
  }
  return (
    <a href={href} style={{
      display: 'block', textAlign: 'center', textDecoration: 'none',
      borderRadius: 12, padding: '14px 20px',
      fontSize: 15, fontWeight: 500, cursor: 'pointer',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      ...vs[variant],
    }}>{children}</a>
  )
}
