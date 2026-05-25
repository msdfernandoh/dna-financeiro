// =============================================================================
// /admin/usuarios — Lista de Usuários Admin (master only)
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode acessar — outros são redirecionados
// =============================================================================

import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { C }                          from '@/app/components/ui'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ProfileRow = {
  id:         string
  name:       string
  email:      string
  phone:      string | null
  role:       string
  unit_id:    string | null
  active:     boolean
  created_at: string
}

// ── Metadados ─────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  master:      { label: '👑 Master',        bg: C.purpleBg,   color: C.purpleDeep },
  unit_admin:  { label: '🛠️ Admin',         bg: C.greenBg,    color: C.greenDark  },
  unit_viewer: { label: '👁️ Visualizador',  bg: C.bgSecondary, color: C.textSec  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminUsuariosPage({ searchParams }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const sp = await searchParams
  const toast = sp.updated ? '✓ Usuário atualizado!' : null
  const filterUnit = sp.unit ?? ''

  const supabase = createServerSupabaseClient()

  const [{ data: rawProfiles }, { data: rawUnits }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, phone, role, unit_id, active, created_at')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('units')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  let profiles: ProfileRow[] = (rawProfiles ?? []) as ProfileRow[]

  // Filtro por unidade (via URL param)
  if (filterUnit) {
    profiles = profiles.filter(p => p.unit_id === filterUnit)
  }

  // Mapa unit_id → nome da unidade
  const unitNames: Record<string, string> = {}
  for (const u of rawUnits ?? []) {
    unitNames[u.id] = u.name
  }

  const kpi = {
    total:    profiles.length,
    active:   profiles.filter(p => p.active).length,
    inactive: profiles.filter(p => !p.active).length,
  }

  return (
    <AdminShell session={session} title="Usuários Admin">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          background: C.greenBg, borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          color: C.greenDark, fontSize: 13, fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12,
        marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            Usuários Admin
          </h1>
          <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
            {kpi.total} usuários · {kpi.active} ativos
            {filterUnit && unitNames[filterUnit] ? ` · ${unitNames[filterUnit]}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filterUnit && (
            <a href="/admin/usuarios" style={{
              border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '8px 14px', fontSize: 12,
              textDecoration: 'none', color: C.textSec, background: '#fff',
            }}>
              ✕ Limpar filtro
            </a>
          )}
          <a href="/admin/usuarios/novo" style={{
            background: C.purple, color: '#fff', textDecoration: 'none',
            borderRadius: 10, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + Novo usuário
          </a>
        </div>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <KpiChip emoji="👤" label="Total"    value={kpi.total}    bg="#F8F8F8"       color={C.text}     />
        <KpiChip emoji="✅" label="Ativos"   value={kpi.active}   bg={C.greenBg}    color={C.greenDark} />
        <KpiChip emoji="⬜" label="Inativos" value={kpi.inactive} bg={C.bgSecondary} color={C.textSec}  />
      </div>

      {/* ── Lista ── */}
      {profiles.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>👤</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 16px' }}>
            Nenhum usuário encontrado.
          </p>
          <a href="/admin/usuarios/novo" style={{
            display: 'inline-block', background: C.purple, color: '#fff',
            borderRadius: 10, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}>
            + Criar primeiro usuário
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.map(profile => {
            const roleMeta   = ROLE_META[profile.role] ?? ROLE_META.unit_viewer
            const unitName   = profile.unit_id ? (unitNames[profile.unit_id] ?? 'Unidade desconhecida') : '—'

            return (
              <div key={profile.id} style={{
                background: '#fff', borderRadius: 14,
                border: `0.5px solid ${profile.active ? C.border : '#E5E7EB'}`,
                padding: '12px 14px',
                opacity: profile.active ? 1 : 0.7,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                {/* Avatar inicial */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: profile.active ? C.purpleBg : C.bgSecondary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: profile.active ? C.purpleDeep : C.textSec,
                }}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                {/* Dados */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      {profile.name}
                    </span>
                    <span style={{
                      background: roleMeta.bg, color: roleMeta.color,
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {roleMeta.label}
                    </span>
                    {!profile.active && (
                      <span style={{
                        background: C.bgSecondary, color: C.textSec,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                      }}>
                        Inativo
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                    {profile.email}
                    {profile.phone ? ` · ${profile.phone}` : ''}
                  </p>
                  <p style={{ fontSize: 10, color: C.textTer, margin: '2px 0 0' }}>
                    🏢 {unitName} · desde {fmtDate(profile.created_at)}
                  </p>
                </div>

                {/* Ação editar */}
                <a href={`/admin/usuarios/${profile.id}/editar`} style={{
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '6px 12px', fontSize: 11,
                  textDecoration: 'none', color: C.textSec, background: '#fff',
                  fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  ✏️ Editar
                </a>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiChip({ emoji, label, value, bg, color }: {
  emoji: string; label: string; value: number; bg: string; color: string
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, border: `0.5px solid ${C.border}`,
      borderRadius: 10, padding: '7px 12px',
    }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color, fontWeight: 500, marginTop: 1, opacity: 0.8 }}>{label}</div>
      </div>
    </div>
  )
}
