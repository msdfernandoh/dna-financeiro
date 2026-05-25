'use client'

// =============================================================================
// EmpresaForm — Formulário progressivo de DNA Empresarial (5 blocos)
//
// SEGURANÇA:
//   • Nenhum unit_id ou lead_id no formulário — resolvidos pelo Server Action
//   • useActionState só captura erros — redirect on success (seguro)
//   • Dados financeiros sensíveis só trafegam servidor ↔ banco
// =============================================================================

import { useActionState } from 'react'
import { saveBusinessProfile } from '@/lib/actions'
import { C } from '@/app/components/ui'
import type { SaveBusinessProfileState, BusinessProfile } from '@/types/database'

// ── Opções dos selects ────────────────────────────────────────────────────────

const SEGMENT_OPTS = [
  { value: 'comercio',      label: '🛒 Comércio'                },
  { value: 'servicos',      label: '🔧 Serviços'               },
  { value: 'alimentacao',   label: '🍽️ Alimentação'            },
  { value: 'saude',         label: '💊 Saúde / Estética'       },
  { value: 'educacao',      label: '📚 Educação'               },
  { value: 'construcao',    label: '🏗️ Construção / Reforma'   },
  { value: 'tecnologia',    label: '💻 Tecnologia'             },
  { value: 'agropecuaria',  label: '🌱 Agropecuária'           },
  { value: 'industria',     label: '🏭 Indústria'              },
  { value: 'transporte',    label: '🚛 Transporte / Logística' },
  { value: 'outro',         label: '📌 Outro'                  },
]

const ACTIVITY_OPTS = [
  { value: 'menos_1',   label: 'Menos de 1 ano'  },
  { value: 'de_1_a_3',  label: 'Entre 1 e 3 anos' },
  { value: 'de_3_a_5',  label: 'Entre 3 e 5 anos' },
  { value: 'mais_5',    label: 'Mais de 5 anos'   },
]

const FORMALIZATION_OPTS = [
  { value: 'mei',       label: '📄 MEI'                       },
  { value: 'ltda',      label: '🏢 LTDA / Empresa Ltda'       },
  { value: 'ei',        label: '👤 EI / Empresário Individual' },
  { value: 'autonomo',  label: '🤝 Autônomo / Freelancer'     },
  { value: 'informal',  label: '🌀 Informal / Sem registro'   },
  { value: 'outro',     label: '📌 Outro'                     },
]

const EMPLOYEE_OPTS = [
  { value: 'apenas_eu',  label: 'Apenas eu'       },
  { value: 'de_1_a_3',   label: '1 a 3 pessoas'   },
  { value: 'de_4_a_10',  label: '4 a 10 pessoas'  },
  { value: 'mais_10',    label: 'Mais de 10'       },
]

const PREMISE_OPTS = [
  { value: 'propria',       label: '🏠 Própria (quitada)'    },
  { value: 'alugada',       label: '🔑 Alugada'              },
  { value: 'compartilhada', label: '🤝 Compartilhada'        },
  { value: 'home_office',   label: '🏡 Home office'          },
  { value: 'ambulante',     label: '🚐 Ambulante / Delivery' },
  { value: 'outro',         label: '📌 Outro'                },
]

const VEHICLE_COUNT_OPTS = [
  { value: '1',        label: '1 veículo'    },
  { value: '2_a_5',    label: '2 a 5'        },
  { value: '6_a_20',   label: '6 a 20'       },
  { value: 'mais_20',  label: 'Mais de 20'   },
]

const VEHICLE_OWNERSHIP_OPTS = [
  { value: 'propria',     label: '✅ Própria / Quitada'  },
  { value: 'financiada',  label: '📋 Financiada'         },
  { value: 'arrendada',   label: '🔄 Arrendada / Leasing' },
  { value: 'terceiros',   label: '🤝 Terceirizada'        },
]

const COLLATERAL_OPTS = [
  { value: 'imovel',   label: '🏠 Imóvel'   },
  { value: 'veiculo',  label: '🚗 Veículo'  },
  { value: 'maquina',  label: '⚙️ Máquinas / Equipamentos' },
  { value: 'outro',    label: '📌 Outro'    },
]

// ── Metadados dos blocos ──────────────────────────────────────────────────────

const BLOCK_META = [
  { num: 1, emoji: '🏪', title: 'Dados Gerais',       subtitle: 'Conte sobre seu negócio' },
  { num: 2, emoji: '📍', title: 'Ponto / Sede',        subtitle: 'Onde você opera?' },
  { num: 3, emoji: '🚛', title: 'Frota de Veículos',   subtitle: 'Veículos no negócio' },
  { num: 4, emoji: '💰', title: 'Capital de Giro',     subtitle: 'Necessidades de crédito' },
  { num: 5, emoji: '🚀', title: 'Crescimento',          subtitle: 'O que precisa para crescer?' },
]

// ── Sub-componentes de campos ─────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: C.text }}>
      {children}
    </p>
  )
}

function TextInput({ name, label, placeholder, defaultValue }: {
  name: string; label: string; placeholder?: string; defaultValue?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${C.border}`, borderRadius: 10,
          padding: '10px 12px', fontSize: 13, color: C.text,
          background: '#fff', outline: 'none', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

function SelectInput({ name, label, options, defaultValue }: {
  name: string; label: string; options: { value: string; label: string }[]; defaultValue?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${C.border}`, borderRadius: 10,
          padding: '10px 12px', fontSize: 13, color: C.text,
          background: '#fff', outline: 'none', fontFamily: 'inherit',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
      >
        <option value="">Selecionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function MoneyInput({ name, label, placeholder, defaultValue }: {
  name: string; label: string; placeholder?: string; defaultValue?: number | null
}) {
  const displayValue = defaultValue != null ? String(defaultValue) : ''
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, color: C.textSec, fontWeight: 600, pointerEvents: 'none',
        }}>R$</span>
        <input
          type="number"
          name={name}
          placeholder={placeholder ?? '0,00'}
          defaultValue={displayValue}
          min="0"
          step="0.01"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: '10px 12px 10px 34px', fontSize: 13, color: C.text,
            background: '#fff', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  )
}

function BoolInput({ name, label, defaultValue }: {
  name: string; label: string; defaultValue?: boolean | null
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { val: 'true',  txt: '✅ Sim' },
          { val: 'false', txt: '❌ Não' },
        ].map(opt => (
          <label key={opt.val} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px solid ${C.border}`, background: '#fff',
            fontSize: 13, fontWeight: 500, color: C.text,
            transition: 'all .15s',
          }}>
            <input
              type="radio"
              name={name}
              value={opt.val}
              defaultChecked={
                opt.val === 'true'  ? defaultValue === true :
                opt.val === 'false' ? defaultValue === false : false
              }
              style={{ accentColor: C.purple }}
            />
            {opt.txt}
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Blocos ────────────────────────────────────────────────────────────────────

function Block1({ profile }: { profile: BusinessProfile | null }) {
  return (
    <>
      <TextInput name="business_name" label="Nome do negócio" placeholder="Ex: Padaria Central" defaultValue={profile?.business_name ?? ''} />
      <SelectInput name="segment" label="Setor do negócio" options={SEGMENT_OPTS} defaultValue={profile?.segment ?? ''} />
      <SelectInput name="activity_years" label="Tempo de atividade" options={ACTIVITY_OPTS} defaultValue={profile?.activity_years ?? ''} />
      <SelectInput name="formalization" label="Situação formal" options={FORMALIZATION_OPTS} defaultValue={profile?.formalization ?? ''} />
      <SelectInput name="employee_count" label="Número de colaboradores" options={EMPLOYEE_OPTS} defaultValue={profile?.employee_count ?? ''} />
      <MoneyInput name="monthly_revenue" label="Faturamento mensal estimado" placeholder="Ex: 15000" defaultValue={profile?.monthly_revenue} />
      <MoneyInput name="monthly_biz_expenses" label="Gastos operacionais mensais" placeholder="Ex: 8000" defaultValue={profile?.monthly_biz_expenses} />
      <p style={{ margin: '-4px 0 14px', fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>
        💡 O lucro será calculado automaticamente (faturamento − gastos).
      </p>
    </>
  )
}

function Block2({ profile }: { profile: BusinessProfile | null }) {
  return (
    <>
      <SelectInput name="premise_type" label="Tipo de local de trabalho" options={PREMISE_OPTS} defaultValue={profile?.premise_type ?? ''} />
      <BoolInput name="has_rent" label="Paga aluguel pelo ponto?" defaultValue={profile?.has_rent} />
      <MoneyInput name="rent_amount" label="Valor do aluguel (se pagar)" placeholder="Ex: 2500" defaultValue={profile?.rent_amount} />
      <BoolInput name="wants_own_premise" label="Gostaria de ter ponto próprio?" defaultValue={profile?.wants_own_premise} />
      <MoneyInput name="monthly_premise_budget" label="Verba mensal disponível para isso" placeholder="Ex: 1500" defaultValue={profile?.monthly_premise_budget} />
    </>
  )
}

function Block3({ profile }: { profile: BusinessProfile | null }) {
  return (
    <>
      <BoolInput name="has_vehicles" label="Usa veículos no negócio?" defaultValue={profile?.has_vehicles} />
      <TextInput name="vehicle_types" label="Tipo(s) de veículo" placeholder="Ex: caminhão, moto, carro" defaultValue={profile?.vehicle_types ?? ''} />
      <SelectInput name="vehicle_count" label="Quantidade de veículos" options={VEHICLE_COUNT_OPTS} defaultValue={profile?.vehicle_count ?? ''} />
      <SelectInput name="vehicle_ownership" label="Situação dos veículos" options={VEHICLE_OWNERSHIP_OPTS} defaultValue={profile?.vehicle_ownership ?? ''} />
      <BoolInput name="wants_fleet_renewal" label="Quer renovar ou ampliar a frota?" defaultValue={profile?.wants_fleet_renewal} />
      <MoneyInput name="monthly_fleet_budget" label="Verba mensal disponível para isso" placeholder="Ex: 3000" defaultValue={profile?.monthly_fleet_budget} />
    </>
  )
}

function Block4({ profile }: { profile: BusinessProfile | null }) {
  return (
    <>
      <BoolInput name="needs_working_capital" label="Precisa de capital de giro?" defaultValue={profile?.needs_working_capital} />
      <MoneyInput name="working_capital_amount" label="Quanto precisaria?" placeholder="Ex: 20000" defaultValue={profile?.working_capital_amount} />
      <TextInput name="working_capital_purpose" label="Para que seria usado?" placeholder="Ex: estocar antes do Natal" defaultValue={profile?.working_capital_purpose ?? ''} />
      <BoolInput name="has_collateral_asset" label="Tem bem para oferecer como garantia?" defaultValue={profile?.has_collateral_asset} />
      <SelectInput name="collateral_type" label="Tipo de garantia" options={COLLATERAL_OPTS} defaultValue={profile?.collateral_type ?? ''} />
      <MoneyInput name="collateral_value" label="Valor estimado da garantia" placeholder="Ex: 80000" defaultValue={profile?.collateral_value} />
    </>
  )
}

function Block5({ profile }: { profile: BusinessProfile | null }) {
  return (
    <>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
        Selecione tudo o que se aplica ao seu negócio agora:
      </p>
      <BoolInput name="needs_equipment" label="Precisa comprar equipamentos ou máquinas?" defaultValue={profile?.needs_equipment} />
      <BoolInput name="needs_renovation" label="Precisa reformar o ponto?" defaultValue={profile?.needs_renovation} />
      <BoolInput name="needs_hiring" label="Quer contratar colaboradores?" defaultValue={profile?.needs_hiring} />
      <BoolInput name="needs_marketing" label="Precisa investir em marketing / divulgação?" defaultValue={profile?.needs_marketing} />
      <BoolInput name="needs_financial_org" label="Quer organizar as finanças do negócio?" defaultValue={profile?.needs_financial_org} />
      <BoolInput name="has_separate_accounts" label="Contas pessoal e empresa são separadas?" defaultValue={profile?.has_separate_accounts} />
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  unitSlug:     string
  currentBlock: number
  profile:      BusinessProfile | null
  bizProgress:  number
}

export function EmpresaForm({ unitSlug, currentBlock, profile, bizProgress }: Props) {
  const boundAction = saveBusinessProfile.bind(null, unitSlug)
  const [errorState, formAction, isPending] = useActionState<SaveBusinessProfileState, FormData>(boundAction, null)

  const blockMeta = BLOCK_META[currentBlock - 1] ?? BLOCK_META[0]

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Progresso geral */}
      <div style={{
        background: '#fff', borderRadius: 14, border: `0.5px solid ${C.border}`,
        padding: '12px 14px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>🏢 DNA Empresarial</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{bizProgress}%</span>
        </div>
        <div style={{ background: C.bgSecondary, borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{
            height: '100%', borderRadius: 99, background: C.purple,
            width: `${Math.max(bizProgress, 3)}%`, transition: 'width 0.5s',
          }} />
        </div>
        {/* Pílulas dos blocos */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {BLOCK_META.map(b => (
            <div key={b.num} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: b.num < currentBlock ? C.purple
                        : b.num === currentBlock ? C.purpleBg
                        : C.border,
            }} />
          ))}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 10, color: C.textSec }}>
          Bloco {currentBlock} de 5
        </p>
      </div>

      {/* Cabeçalho do bloco */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purple}15 0%, ${C.purpleBg} 100%)`,
        borderRadius: 14, padding: '14px', marginBottom: 14,
        border: `0.5px solid ${C.purple}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{blockMeta.emoji}</span>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.purpleDeep }}>
              {blockMeta.title}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>{blockMeta.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form action={formAction} style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '16px',
      }}>
        <input type="hidden" name="block" value={currentBlock} />

        {currentBlock === 1 && <Block1 profile={profile} />}
        {currentBlock === 2 && <Block2 profile={profile} />}
        {currentBlock === 3 && <Block3 profile={profile} />}
        {currentBlock === 4 && <Block4 profile={profile} />}
        {currentBlock === 5 && <Block5 profile={profile} />}

        {/* Erro */}
        {errorState && (
          <div style={{
            background: '#FEF2F2', borderRadius: 10, padding: '10px 14px',
            marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 12, color: '#991B1B' }}>{errorState.error}</p>
          </div>
        )}

        {/* Botão submit */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%',
            background: isPending ? C.textSec : C.purple,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px',
            fontSize: 14,
            fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background .15s',
          }}
        >
          {isPending
            ? 'Salvando...'
            : currentBlock < 5 ? `Próximo: ${BLOCK_META[currentBlock]?.title ?? 'Concluir'} →`
            : '✅ Concluir DNA Empresarial'}
        </button>
      </form>

      {/* Navegação entre blocos */}
      {currentBlock > 1 && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <a href={`/${unitSlug}/empresa?bloco=${currentBlock - 1}`}
            style={{ fontSize: 12, color: C.textSec, textDecoration: 'none' }}>
            ← Bloco anterior
          </a>
        </div>
      )}

      {/* Consentimento */}
      <p style={{ fontSize: 10, color: C.textTer, lineHeight: 1.5, marginTop: 12, textAlign: 'center' }}>
        🔒 Dados empresariais protegidos e usados apenas para diagnóstico financeiro.
        Não compartilhamos com terceiros sem sua autorização.
      </p>
    </div>
  )
}
