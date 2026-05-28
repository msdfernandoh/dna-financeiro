// =============================================================================
// /admin/eventos/gauchinho/leads/[id] — Detalhe de lead do evento construtora
//
// SEGURANÇA:
//   • requireAdmin() + masterOnly
//   • Lead buscado por id e event_key para garantir escopo
// =============================================================================

import type { ReactNode }             from 'react'
import { notFound, redirect }        from 'next/navigation'
import { requireAdmin }              from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                from '@/app/admin/_AdminShell'
import { C }                         from '@/app/components/ui'
import { SituacaoSelect }            from '../_SituacaoSelect'
import { AnexosSection }             from './_AnexosSection'

export const metadata = { title: 'Lead · Evento Construtora · Admin DNA Financeiro' }

interface Props {
  params: Promise<{ id: string }>
}

function fmtBRL(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`
}

function YesNo({ v }: { v: boolean | null }) {
  if (v === null || v === undefined) return <span style={{ color: C.textTer }}>—</span>
  return (
    <span style={{
      background: v ? C.greenBg : C.bgSecondary,
      color: v ? C.greenDark : C.textSec,
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 99,
    }}>
      {v ? 'Sim' : 'Não'}
    </span>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: `0.5px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 12, color: C.textSec, minWidth: 180, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  )
}

export default async function AdminLeadDetailPage({ params }: Props) {
  const session = await requireAdmin()
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

  return (
    <AdminShell
      session={session}
      title={lead.name}
      back={{ href: '/admin/eventos/gauchinho/leads', label: 'Leads do Evento' }}
    >

      {/* Cabeçalho */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${C.border}`,
        padding: '20px',
        marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.purple}25, ${C.purpleDeep}15)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: C.purpleDeep,
        }}>
          {lead.name.trim().charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
            {lead.name}
          </h1>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: C.textSec }}>
            {fmtPhone(lead.whatsapp)}
            {lead.city && ` · ${lead.city}`}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={waLink(lead.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                color: '#fff', borderRadius: 10, padding: '8px 16px',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}
            >
              💬 Abrir WhatsApp
            </a>
            {lead.consent_share_builder && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: C.greenBg, color: C.greenDark,
                borderRadius: 10, padding: '8px 14px',
                fontSize: 12, fontWeight: 600,
              }}>
                🏗️ Autorizado para construtora
              </span>
            )}
            <SituacaoSelect leadId={lead.id} initial={(lead as Record<string, unknown>).situacao as string ?? 'enviar_proposta'} />
          </div>
        </div>
      </div>

      {/* ── Contato ── */}
      <Section title="📞 Contato">
        <Row label="WhatsApp" value={fmtPhone(lead.whatsapp)} />
        <Row label="CPF"      value={lead.cpf ?? '—'} />
        <Row label="Cidade"   value={lead.city} />
      </Section>

      {/* ── Dados do imóvel ── */}
      <Section title="🏠 Imóvel">
        <Row label="Empreendimento" value={lead.empreendimento} />
        <Row label="Torre / Bloco"  value={lead.torre} />
        <Row label="Apartamento"    value={lead.apartamento} />
        <Row label="Valor do imóvel"          value={fmtBRL(lead.valor_imovel)} />
        <Row label="Valor entrega / chaves"   value={fmtBRL(lead.valor_entrega)} />
        <Row label="Valor disponível"         value={fmtBRL(lead.valor_entrada_disponivel)} />
        <Row label="Renda aproximada"         value={fmtBRL(lead.renda_aproximada)} />
        <Row label="Melhor horário"           value={lead.melhor_horario_contato} />
      </Section>

      {/* ── Interesses ── */}
      <Section title="🎯 Interesses">
        <Row label="Financiamento"      value={<YesNo v={lead.precisa_financiamento} />} />
        <Row label="Consórcio"          value={<YesNo v={lead.interesse_consorcio} />} />
        <Row label="Carta contemplada"  value={<YesNo v={lead.interesse_carta_contemplada} />} />
        <Row label="Crédito"            value={<YesNo v={lead.interesse_credito} />} />
        <Row label="Plano Pontual"      value={<YesNo v={lead.interesse_plano_pontual} />} />
      </Section>

      {/* ── Observações ── */}
      {lead.observacoes && (
        <Section title="📝 Observações">
          <div style={{ padding: '10px 0' }}>
            <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.65 }}>
              {lead.observacoes}
            </p>
          </div>
        </Section>
      )}

      {/* ── Consentimentos ── */}
      <Section title="🔒 Consentimentos e LGPD">
        <Row label="Consentimento de contato"             value={<YesNo v={lead.consent_contact} />} />
        <Row label="Autorizado para construtora"          value={<YesNo v={lead.consent_share_builder} />} />
      </Section>

      {/* ── Anexos ── */}
      <AnexosSection leadId={lead.id} />

      {/* ── Rastreamento ── */}
      <Section title="📊 Rastreamento">
        <Row label="Data de cadastro" value={fmtDate(lead.created_at)} />
        <Row label="Fonte (página)"   value={lead.source_page} />
        <Row label="Evento"           value={lead.event_name} />
        <Row label="Event key"        value={lead.event_key} />
        <Row label="IP"               value={lead.ip_address} />
        <Row label="User Agent"       value={
          <span style={{ fontSize: 11, color: C.textSec, wordBreak: 'break-all' }}>
            {lead.user_agent || '—'}
          </span>
        } />
      </Section>

    </AdminShell>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `0.5px solid ${C.border}`,
      padding: '16px 18px',
      marginBottom: 12,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: C.text }}>
        {title}
      </p>
      {children}
    </div>
  )
}
