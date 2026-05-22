'use client'

import { useActionState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '@/app/components/ui'
import type { AdminOppResult, OpportunityAdmin, OppType } from '@/types/database'

// ── Metadados de tipo ─────────────────────────────────────────────────────────

const OPP_TYPES: { value: OppType; label: string; emoji: string }[] = [
  { value: 'event',     label: 'Evento',       emoji: '📅' },
  { value: 'course',    label: 'Educação',     emoji: '📚' },
  { value: 'challenge', label: 'Desafio',      emoji: '🎯' },
  { value: 'job',       label: 'Renda extra',  emoji: '💼' },
  { value: 'banner',    label: 'Banner',       emoji: '📣' },
  { value: 'partner',   label: 'Parceiro',     emoji: '🤝' },
]

const DREAM_OPTIONS = [
  { value: 'carro',     label: '🚗 Carro'           },
  { value: 'casa',      label: '🏠 Casa'            },
  { value: 'negocio',   label: '🏪 Negócio'         },
  { value: 'viagem',    label: '✈️ Viagem'           },
  { value: 'reserva',   label: '🐷 Reserva'         },
  { value: 'faculdade', label: '🎓 Faculdade'       },
  { value: 'reforma',   label: '🔨 Reforma'         },
  { value: 'dividas',   label: '💳 Dívidas'         },
  { value: 'moto',      label: '🏍️ Moto'            },
  { value: 'outro',     label: '⭐ Outro'           },
]

// ── Estilos compartilhados ────────────────────────────────────────────────────

const inputSt: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `0.5px solid ${C.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13,
  fontFamily: 'inherit', color: C.text, background: '#fff',
  outline: 'none',
}

const labelSt: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: C.textSec, marginBottom: 5,
}

const cardSt: CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: `0.5px solid ${C.border}`,
  padding: '16px', marginBottom: 12,
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  action:   (prev: AdminOppResult | null, fd: FormData) => Promise<AdminOppResult>
  initial?: Partial<OpportunityAdmin>
  units?:   { id: string; name: string }[]   // preenchido apenas para master
  isMaster: boolean
  unitId?:  string                            // para unit_admin (fixo)
  mode:     'create' | 'edit'
}

// ── Componente ────────────────────────────────────────────────────────────────

export function OppFormClient({ action, initial, units, isMaster, unitId, mode }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const def = initial ?? {}

  return (
    <form action={formAction} noValidate>

      {/* ── Unidade (master escolhe; unit_admin: hidden) ── */}
      {isMaster ? (
        <div style={cardSt}>
          <label style={labelSt}>
            Unidade <span style={{ color: C.coral }}>*</span>
          </label>
          <select
            name="unit_id"
            defaultValue={def.unit_id ?? ''}
            required
            style={{ ...inputSt }}
          >
            <option value="">Selecione a unidade...</option>
            {(units ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {state?.success === false && state.field === 'unit_id' && (
            <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{state.error}</p>
          )}
        </div>
      ) : (
        <input type="hidden" name="unit_id" value={unitId ?? ''} />
      )}

      {/* ── Tipo ── */}
      <div style={cardSt}>
        <p style={{ ...labelSt, marginBottom: 10 }}>
          Tipo <span style={{ color: C.coral }}>*</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {OPP_TYPES.map(t => (
            <TypeCard key={t.value} type={t} defaultChecked={def.type === t.value} />
          ))}
        </div>
        {state?.success === false && state.field === 'type' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '8px 0 0' }}>{state.error}</p>
        )}
      </div>

      {/* ── Título ── */}
      <div style={cardSt}>
        <label style={labelSt} htmlFor="title">
          Título <span style={{ color: C.coral }}>*</span>
        </label>
        <input
          id="title"
          type="text"
          name="title"
          required
          maxLength={200}
          defaultValue={def.title ?? ''}
          placeholder="Ex: Aula gratuita de educação financeira"
          style={{
            ...inputSt,
            borderColor: state?.success === false && state.field === 'title' ? C.coral : C.border,
          }}
        />
        {state?.success === false && state.field === 'title' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{state.error}</p>
        )}
      </div>

      {/* ── Descrição ── */}
      <div style={cardSt}>
        <label style={labelSt} htmlFor="description">
          Descrição <span style={{ color: C.textTer }}>(opcional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={def.description ?? ''}
          placeholder="Detalhes da oportunidade para o lead..."
          style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {/* ── CTA ── */}
      <div style={cardSt}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelSt} htmlFor="cta_label">
              Texto do botão <span style={{ color: C.textTer }}>(opcional)</span>
            </label>
            <input
              id="cta_label"
              type="text"
              name="cta_label"
              maxLength={60}
              defaultValue={def.cta_label ?? ''}
              placeholder="Ex: Saber mais"
              style={inputSt}
            />
          </div>
          <div>
            <label style={labelSt} htmlFor="cta_url">
              Link (URL) <span style={{ color: C.textTer }}>(opcional)</span>
            </label>
            <input
              id="cta_url"
              type="url"
              name="cta_url"
              defaultValue={def.cta_url ?? ''}
              placeholder="https://..."
              style={inputSt}
            />
          </div>
        </div>
        <p style={{ fontSize: 11, color: C.textTer, margin: '8px 0 0' }}>
          💡 Sem URL, o botão mostra "Tenho interesse" e registra a interação do lead.
        </p>
      </div>

      {/* ── Sonho alvo ── */}
      <div style={cardSt}>
        <label style={labelSt} htmlFor="target_dream">
          Sonho alvo <span style={{ color: C.textTer }}>(opcional — aparece na aba "Seu sonho")</span>
        </label>
        <select
          id="target_dream"
          name="target_dream"
          defaultValue={def.target_dream ?? ''}
          style={inputSt}
        >
          <option value="">Para todos os perfis</option>
          {DREAM_OPTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* ── Posição ── */}
      <div style={cardSt}>
        <label style={labelSt} htmlFor="position">
          Posição na lista <span style={{ color: C.textTer }}>(menor = aparece primeiro)</span>
        </label>
        <input
          id="position"
          type="number"
          name="position"
          min={0}
          max={999}
          defaultValue={def.position ?? 0}
          style={{ ...inputSt, maxWidth: 120 }}
        />
      </div>

      {/* ── Período de exibição ── */}
      <div style={cardSt}>
        <p style={{ ...labelSt, marginBottom: 4 }}>
          Período de exibição <span style={{ color: C.textTer }}>(opcional)</span>
        </p>
        <p style={{ fontSize: 10, color: C.textTer, margin: '0 0 10px' }}>
          🕐 Horário UTC · Brasil (Brasília) = UTC−3 · Ex: 10:00 BRT = 13:00 UTC
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelSt} htmlFor="starts_at">
              Início da exibição
            </label>
            <input
              id="starts_at"
              type="datetime-local"
              name="starts_at"
              defaultValue={def.starts_at ? def.starts_at.slice(0, 16) : ''}
              style={inputSt}
            />
          </div>
          <div>
            <label style={labelSt} htmlFor="ends_at">
              Fim da exibição
            </label>
            <input
              id="ends_at"
              type="datetime-local"
              name="ends_at"
              defaultValue={def.ends_at ? def.ends_at.slice(0, 16) : ''}
              style={inputSt}
            />
          </div>
        </div>
        {state?.success === false && state.field === 'period' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{state.error}</p>
        )}
        <p style={{ fontSize: 11, color: C.textTer, margin: '8px 0 0' }}>
          💡 Sem período definido, a oportunidade fica visível enquanto estiver ativa.
        </p>
      </div>

      {/* ── Toggles: Destaque + Ativo ── */}
      <div style={{ ...cardSt, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <ToggleField
          name="featured"
          label="⭐ Destaque da semana"
          description="Aparece no topo com banner roxo."
          defaultChecked={def.featured ?? false}
        />
        <ToggleField
          name="active"
          label="✅ Ativo (visível para leads)"
          description="Desativada: salva mas não aparece."
          defaultChecked={def.active ?? true}
        />
      </div>

      {/* ── Erro geral ── */}
      {state?.success === false && !state.field && (
        <div style={{
          background: C.coralBg, borderRadius: 12,
          padding: '12px 14px', marginBottom: 12,
          color: C.coralDark, fontSize: 13,
        }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <a
          href="/admin/oportunidades"
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
            : mode === 'create' ? '✓ Criar oportunidade' : '✓ Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TypeCard({
  type, defaultChecked,
}: {
  type: { value: string; label: string; emoji: string }
  defaultChecked: boolean
}) {
  return (
    <label style={{ display: 'block', cursor: 'pointer' }}>
      <input
        type="radio"
        name="type"
        value={type.value}
        defaultChecked={defaultChecked}
        style={{ position: 'absolute', opacity: 0, width: 0 }}
      />
      <div style={{
        border: `1.5px solid ${C.border}`, borderRadius: 12,
        padding: '10px 6px', textAlign: 'center',
        transition: 'all .15s',
      }}
        className="type-card"
        data-value={type.value}
      >
        <div style={{ fontSize: 20, marginBottom: 4 }}>{type.emoji}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.textSec }}>{type.label}</div>
      </div>
      <style>{`
        input[name="type"][value="${type.value}"]:checked ~ div.type-card[data-value="${type.value}"],
        label:has(input[name="type"][value="${type.value}"]:checked) .type-card {
          border-color: #7F77DD !important;
          background: #EEEDFE !important;
        }
        label:has(input[name="type"][value="${type.value}"]:checked) .type-card div:last-child {
          color: #534AB7 !important;
        }
      `}</style>
    </label>
  )
}

function ToggleField({
  name, label, description, defaultChecked,
}: {
  name: string; label: string; description: string; defaultChecked: boolean
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', flex: 1, minWidth: 200 }}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: C.purple, flexShrink: 0 }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}</div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{description}</div>
      </div>
    </label>
  )
}
