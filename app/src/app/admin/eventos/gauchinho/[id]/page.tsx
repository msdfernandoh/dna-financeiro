// =============================================================================
// /admin/eventos/gauchinho/[id] — Detalhe de um lead do evento
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • masterOnly: redireciona se role !== 'master'
//   • Filtra por id + event_key + deleted_at IS NULL
// =============================================================================

import { notFound, redirect }         from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '../../../_AdminShell'
import { C }                          from '@/app/components/ui'
import type { EventLead }             from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtBRL(v: number | null): string {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/55${d}`
}

function BoolBadge({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <span style={{
      background: value ? C.greenBg : C.bgSecondary,
      color:      value ? C.greenDark : C.textSec,
      fontSize: 11, fontWeight: 600,
      padding: '3px 10px', borderRadius: 99,
    }}>
      {value ? `✅ ${trueLabel}` : `○ ${falseLabel}`}
    </span>
  )
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug?: string; id: string }>
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function AdminGauchinhoLeadDetailPage({ params }: Props) {
  const session = await requireAdmin()

  // masterOnly
  if (session.role !== 'master') redirect('/admin')

  const { id } = await params

  const supabase = createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('event_leads')
    .select('*')
    .eq('id', id)
    .eq('event_key', 'gauchinho_construtora')
    .is('deleted_at', null)
    .single()

  if (!lead) notFound()

  const el = lead as EventLead

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminShell
      session={session}
      title={el.name}
      back={{ href: '/admin/eventos/gauchinho', label: 'Gauchinho × Construtora' }}
    >

      {/* ── Cabeçalho do lead ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${C.border}`,
        padding: '20px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #1B4F8A20, #1B4F8A10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#1B4F8A',
          }}>
            {el.name.trim().charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
              {el.name}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <BoolBadge value={el.consent_share_builder} trueLabel="Exportável" falseLabel="Sem consent exportação" />
              <BoolBadge value={el.consent_contact}       trueLabel="Contato OK"  falseLabel="Sem consent contato" />
            </div>
            <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
              Cadastrado em {fmtDateTime(el.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Grid de blocos ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Contato */}
        <Section title="📱 Contato">
          <Row label="Nome"     value={el.name} />
          <Row
            label="WhatsApp"
            value={
              <a href={waLink(el.whatsapp)} target="_blank" rel="noopener noreferrer"
                style={{ color: '#1D9E75', fontWeight: 600, textDecoration: 'none' }}>
                {fmtPhone(el.whatsapp)} 💬
              </a>
            }
          />
          {el.cpf && <Row label="CPF" value={`***.***.***-${el.cpf.slice(-2)}`} sensitive />}
          <Row label="Melhor horário" value={el.melhor_horario_contato || '—'} />
        </Section>

        {/* Apartamento */}
        <Section title="🏗️ Apartamento">
          <Row label="Empreendimento" value={el.empreendimento || '—'} />
          <Row label="Torre / Bloco"  value={el.torre          || '—'} />
          <Row label="Apartamento"    value={el.apartamento    || '—'} />
        </Section>

        {/* Financeiro */}
        <Section title="💰 Dados Financeiros">
          <Row label="Valor do imóvel"          value={fmtBRL(el.valor_imovel)} />
          <Row label="Valor de entrega"          value={fmtBRL(el.valor_entrega)} />
          <Row label="Entrada disponível"        value={fmtBRL(el.valor_entrada_disponivel)} />
          <Row label="Renda aproximada/mês"      value={fmtBRL(el.renda_aproximada)} />
        </Section>

        {/* Interesses */}
        <Section title="🎯 Interesses">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <BoolBadge value={el.precisa_financiamento}       trueLabel="Financiamento"      falseLabel="Sem financiamento" />
            <BoolBadge value={el.interesse_consorcio}         trueLabel="Consórcio"           falseLabel="Sem consórcio" />
            <BoolBadge value={el.interesse_carta_contemplada} trueLabel="Carta contemplada"   falseLabel="Sem carta" />
            <BoolBadge value={el.interesse_credito}           trueLabel="Crédito"             falseLabel="Sem crédito" />
            <BoolBadge value={el.interesse_plano_pontual}     trueLabel="Plano Pontual"       falseLabel="Sem Plano Pontual" />
          </div>
        </Section>

        {/* Observações */}
        {el.observacoes && (
          <Section title="📝 Observações">
            <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.65 }}>
              {el.observacoes}
            </p>
          </Section>
        )}

        {/* Técnico */}
        <Section title="⚙️ Dados Técnicos">
          <Row label="Source page"  value={el.source_page || '—'} mono />
          <Row label="IP"           value={el.ip_address  || '—'} mono />
          <Row label="User agent"   value={el.user_agent ? el.user_agent.slice(0, 80) + '…' : '—'} mono />
          <Row label="Event key"    value={el.event_key}  mono />
          <Row label="ID"           value={el.id}         mono />
          <Row label="Criado em"    value={fmtDateTime(el.created_at)} />
          <Row label="Atualizado"   value={fmtDateTime(el.updated_at)} />
        </Section>

      </div>

    </AdminShell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `0.5px solid ${C.border}`,
      overflow: 'hidden',
    }}>
      <div style={{
        background: C.bgSecondary,
        borderBottom: `0.5px solid ${C.border}`,
        padding: '10px 16px',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textSec }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono = false,
  sensitive = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  sensitive?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 12, color: C.textSec, fontWeight: 500,
        minWidth: 140, flexShrink: 0, paddingTop: 1,
      }}>
        {label}
        {sensitive && (
          <span style={{
            background: '#FEF3C7', color: '#92400E',
            fontSize: 8, padding: '1px 5px', borderRadius: 4,
            marginLeft: 4, fontWeight: 700,
          }}>SENSÍVEL</span>
        )}
      </span>
      <span style={{
        fontSize: 13, color: C.text, wordBreak: 'break-all',
        fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      }}>
        {value ?? '—'}
      </span>
    </div>
  )
}
