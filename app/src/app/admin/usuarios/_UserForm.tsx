'use client'

// =============================================================================
// Formulário compartilhado: Criar / Editar Usuário Admin
// Client Component — useActionState, inline styles (padrão do projeto)
// =============================================================================

import { useActionState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '@/app/components/ui'
import { CopyButton } from '@/app/admin/unidades/_CopyButton'
import type { UserFormResult } from './actions'

// ── Metadados ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'unit_admin',  label: '🛠️ Admin',         desc: 'Cria e edita oportunidades, vê leads da unidade' },
  { value: 'unit_viewer', label: '👁️ Visualizador',  desc: 'Somente leitura — não edita nada' },
]

// ── Estilos ───────────────────────────────────────────────────────────────────

const inputSt: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `0.5px solid ${C.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13,
  fontFamily: 'inherit', color: C.text, background: '#fff',
  outline: 'none',
}

const labelSt: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textSec, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4,
}

const cardSt: CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: `0.5px solid ${C.border}`,
  padding: '16px', marginBottom: 12,
}

const sectionTitleSt: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.purple,
  margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5,
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface UserDefaultValues {
  name:    string
  email:   string
  phone:   string
  role:    string
  unit_id: string
  active:  boolean
}

interface Props {
  action:         (prev: UserFormResult | null, fd: FormData) => Promise<UserFormResult>
  defaultValues?: Partial<UserDefaultValues>
  mode:           'create' | 'edit'
  backHref:       string
  units:          { id: string; name: string }[]
  // Para o modo editar: ação de reset de senha
  resetAction?:   (prev: UserFormResult | null, fd: FormData) => Promise<UserFormResult>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function UserForm({
  action, defaultValues: dv = {}, mode, backHref, units, resetAction,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [resetState, resetFormAction, isResetting] = useActionState(
    resetAction ?? (async () => ({ success: false as const, error: '' })),
    null,
  )

  const fieldError = (field: string) =>
    state?.success === false && state.field === field ? state.error : null

  // Criação concluída — exibe tela de senha temporária
  if (mode === 'create' && state?.success === true && state.tempPassword) {
    return (
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `1.5px solid ${C.green}`,
        padding: '24px 20px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 28, margin: '0 0 8px' }}>🎉</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
          Usuário criado com sucesso!
        </p>
        <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 20px' }}>
          Compartilhe a senha abaixo com o usuário. Ela não será exibida novamente.
        </p>

        {/* Senha temporária */}
        <div style={{
          background: C.amberBg, border: `1px solid ${C.amber}`,
          borderRadius: 12, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.amberDark, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            🔑 Senha temporária
          </p>
          <div style={{
            fontFamily: 'monospace', fontSize: 20, fontWeight: 700,
            color: C.text, letterSpacing: 4,
            background: '#fff', borderRadius: 8, padding: '8px 20px',
          }}>
            {state.tempPassword}
          </div>
          <CopyButton text={state.tempPassword} label="Copiar senha" />
        </div>

        <p style={{ fontSize: 11, color: C.textTer, margin: '0 0 20px' }}>
          ⚠️ O usuário deverá trocar a senha no primeiro acesso.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={backHref} style={{
            background: C.purple, color: '#fff', textDecoration: 'none',
            borderRadius: 10, padding: '10px 20px',
            fontSize: 13, fontWeight: 600,
          }}>
            ← Voltar para lista
          </a>
          <a href="/admin/usuarios/novo" style={{
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '10px 20px', fontSize: 13,
            textDecoration: 'none', color: C.textSec, background: '#fff',
          }}>
            + Novo usuário
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <form action={formAction} noValidate>

        {/* ══ DADOS PESSOAIS ══════════════════════════════════════════════════ */}
        <div style={cardSt}>
          <p style={sectionTitleSt}>👤 Dados pessoais</p>

          {/* Nome */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt} htmlFor="name">
              Nome completo <span style={{ color: C.coral }}>*</span>
            </label>
            <input
              id="name" name="name" type="text"
              required maxLength={120}
              defaultValue={dv.name ?? ''}
              placeholder="João Silva"
              style={{ ...inputSt, borderColor: fieldError('name') ? C.coral : C.border }}
            />
            {fieldError('name') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('name')}</p>
            )}
          </div>

          {/* E-mail + Telefone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt} htmlFor="email">
                E-mail <span style={{ color: C.coral }}>*</span>
              </label>
              <input
                id="email" name="email" type="email"
                required maxLength={200}
                defaultValue={dv.email ?? ''}
                placeholder="joao@exemplo.com"
                style={{ ...inputSt, borderColor: fieldError('email') ? C.coral : C.border }}
              />
              {fieldError('email') && (
                <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('email')}</p>
              )}
            </div>
            <div>
              <label style={labelSt} htmlFor="phone">
                Telefone <span style={{ color: C.textTer }}>(opcional)</span>
              </label>
              <input
                id="phone" name="phone" type="text"
                inputMode="tel" maxLength={20}
                defaultValue={dv.phone ?? ''}
                placeholder="(65) 99999-1234"
                style={inputSt}
              />
            </div>
          </div>
        </div>

        {/* ══ PERFIL E UNIDADE ════════════════════════════════════════════════ */}
        <div style={cardSt}>
          <p style={sectionTitleSt}>🏢 Perfil e unidade</p>

          {/* Tipo de perfil */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>
              Perfil <span style={{ color: C.coral }}>*</span>
            </label>
            <p style={{ fontSize: 10, color: C.textTer, margin: '0 0 8px' }}>
              ⚠️ Perfil Master não pode ser criado pela tela neste MVP.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLE_OPTIONS.map(opt => (
                <label key={opt.value} style={{ cursor: 'pointer' }}>
                  <input
                    type="radio" name="role" value={opt.value}
                    defaultChecked={(dv.role ?? 'unit_admin') === opt.value}
                    style={{ position: 'absolute', opacity: 0, width: 0 }}
                  />
                  <div style={{
                    border: `1.5px solid ${C.border}`, borderRadius: 10,
                    padding: '10px 12px',
                  }}
                    className={`role-card-${opt.value}`}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>{opt.desc}</div>
                  </div>
                  <style>{`
                    label:has(input[name="role"][value="${opt.value}"]:checked) .role-card-${opt.value} {
                      border-color: #7F77DD !important;
                      background: #EEEDFE !important;
                    }
                    label:has(input[name="role"][value="${opt.value}"]:checked) .role-card-${opt.value} div:first-child {
                      color: #534AB7 !important;
                    }
                  `}</style>
                </label>
              ))}
            </div>
            {fieldError('role') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{fieldError('role')}</p>
            )}
          </div>

          {/* Unidade */}
          <div>
            <label style={labelSt} htmlFor="unit_id">
              Unidade <span style={{ color: C.coral }}>*</span>
            </label>
            <select
              id="unit_id" name="unit_id"
              defaultValue={dv.unit_id ?? ''}
              style={{ ...inputSt, borderColor: fieldError('unit_id') ? C.coral : C.border }}
            >
              <option value="">Selecione a unidade...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {fieldError('unit_id') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('unit_id')}</p>
            )}
          </div>
        </div>

        {/* ══ STATUS (somente edição) ══════════════════════════════════════════ */}
        {mode === 'edit' && (
          <div style={cardSt}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <input
                type="checkbox" name="active"
                defaultChecked={dv.active ?? true}
                style={{ width: 18, height: 18, accentColor: C.purple }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  ✅ Usuário ativo
                </div>
                <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                  Desativado: não consegue fazer login.
                </div>
              </div>
            </label>
          </div>
        )}

        {/* ══ ERRO GERAL ══════════════════════════════════════════════════════ */}
        {state?.success === false && !state.field && (
          <div style={{
            background: C.coralBg, borderRadius: 12,
            padding: '12px 14px', marginBottom: 12,
            color: C.coralDark, fontSize: 13,
          }}>
            ⚠️ {state.error}
          </div>
        )}

        {/* ══ BOTÕES ══════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <a
            href={backHref}
            style={{
              padding: '12px 20px', borderRadius: 12, fontSize: 13,
              border: `1px solid ${C.border}`, textDecoration: 'none',
              color: C.textSec, background: '#fff', fontWeight: 500,
            }}
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={isPending}
            style={{
              flex: 1, border: 'none', borderRadius: 12,
              padding: '12px 20px', fontSize: 13, fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              background: isPending ? 'rgba(0,0,0,0.12)' : C.purple,
              color: isPending ? C.textSec : '#fff',
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            {isPending
              ? 'Salvando...'
              : mode === 'create' ? '✓ Criar usuário' : '✓ Salvar alterações'}
          </button>
        </div>
      </form>

      {/* ══ SEÇÃO RESET DE SENHA (somente edição) ═══════════════════════════ */}
      {mode === 'edit' && resetAction && (
        <div style={{ ...cardSt, marginTop: 24, border: `0.5px solid ${C.amberBg}` }}>
          <p style={{ ...sectionTitleSt, color: C.amberDark }}>🔑 Redefinir senha</p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 12px' }}>
            Gera uma nova senha temporária para o usuário. A senha atual será invalidada.
          </p>

          {/* Senha nova exibida após reset */}
          {resetState?.success === true && resetState.tempPassword && (
            <div style={{
              background: C.amberBg, border: `1px solid ${C.amber}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.amberDark, margin: 0 }}>
                ✅ Senha redefinida! Compartilhe abaixo:
              </p>
              <div style={{
                fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
                color: C.text, letterSpacing: 3,
                background: '#fff', borderRadius: 8, padding: '6px 16px',
              }}>
                {resetState.tempPassword}
              </div>
              <CopyButton text={resetState.tempPassword} label="Copiar senha" />
            </div>
          )}

          {resetState?.success === false && (
            <div style={{
              background: C.coralBg, borderRadius: 10,
              padding: '10px 12px', marginBottom: 12,
              color: C.coralDark, fontSize: 13,
            }}>
              ⚠️ {resetState.error}
            </div>
          )}

          <form action={resetFormAction}>
            <button
              type="submit"
              disabled={isResetting}
              style={{
                border: `1px solid ${C.amber}`, borderRadius: 10,
                padding: '10px 18px', fontSize: 12, fontWeight: 600,
                cursor: isResetting ? 'not-allowed' : 'pointer',
                background: isResetting ? C.bgSecondary : C.amberBg,
                color: isResetting ? C.textSec : C.amberDark,
                fontFamily: 'inherit', transition: 'all .2s',
              }}
            >
              {isResetting ? 'Gerando...' : '🔑 Gerar nova senha temporária'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
