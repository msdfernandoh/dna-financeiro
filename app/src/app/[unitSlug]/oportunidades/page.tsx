// =============================================================================
// /[unitSlug]/oportunidades — Server Component
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do browser
//   • unit_id resolvido do banco a partir do leadId + unitSlug — nunca do client
//   • Valida unit_slug para impedir cross-unit
//   • Respostas DNA usadas apenas para personalização visual — não expostas
//   • Dados internos (unit_id, lead_id) não chegam ao Client Component
// =============================================================================

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { OpportunitiesClient } from './OpportunitiesClient'
import type { OppCard } from './OpportunitiesClient'

interface Props {
  params: Promise<{ unitSlug: string }>
}

// ── Mapeamento de sonhos ────────────────────────────────────────────────────

const DREAM_LABELS: Record<string, { label: string; emoji: string }> = {
  carro:     { label: 'Carro próprio',         emoji: '🚗' },
  casa:      { label: 'Casa própria',          emoji: '🏠' },
  negocio:   { label: 'Negócio próprio',       emoji: '🏪' },
  viagem:    { label: 'Viagem dos sonhos',      emoji: '✈️' },
  reserva:   { label: 'Reserva de emergência', emoji: '🐷' },
  faculdade: { label: 'Faculdade',              emoji: '🎓' },
  reforma:   { label: 'Reforma da casa',        emoji: '🔨' },
  dividas:   { label: 'Quitar dívidas',         emoji: '💳' },
  moto:      { label: 'Moto',                   emoji: '🏍️' },
  outro:     { label: 'Outro sonho',            emoji: '⭐' },
}

// ── Gerador de fallback personalizado ─────────────────────────────────────

function buildFallback(
  dream: string,
  hasDebt: boolean,
  wantsRenda: boolean,
): OppCard[] {
  const list: OppCard[] = []
  let seq = 1000 // IDs fictícios para fallback (não são UUIDs do banco)

  const mk = (partial: Omit<OppCard, 'id' | 'isReal'>): OppCard => ({
    id: `fallback-${seq++}`,
    isReal: false,
    ...partial,
  })

  // ── Para todos ──
  list.push(mk({
    type: 'course',
    title: 'Aula gratuita: Como organizar sua vida financeira em 30 dias',
    description: 'Aprenda a controlar gastos, criar sua primeira reserva e dar os primeiros passos para realizar seus sonhos.',
    cta_label: 'Quero participar',
    cta_url: null,
    target_dream: null,
    featured: true,
  }))

  list.push(mk({
    type: 'challenge',
    title: 'Desafio 7 dias: Registre tudo e descubra onde vai seu dinheiro',
    description: 'Sete dias de ações simples para ter clareza total sobre seus gastos. Gratuito e sem compromisso.',
    cta_label: 'Aceitar desafio',
    cta_url: null,
    target_dream: null,
    featured: false,
  }))

  // ── Renda extra ──
  if (wantsRenda) {
    list.push(mk({
      type: 'job',
      title: 'Cadastre-se para oportunidades de diárias aos finais de semana',
      description: 'Trabalhe nos fins de semana e ganhe uma renda extra sem compromisso de horário fixo.',
      cta_label: 'Cadastrar agora',
      cta_url: null,
      target_dream: null,
      featured: false,
    }))
  } else {
    list.push(mk({
      type: 'job',
      title: 'Descubra como ganhar renda extra com suas habilidades',
      description: 'Veja oportunidades de trabalho flexível que combinam com seu perfil e disponibilidade.',
      cta_label: 'Ver oportunidades',
      cta_url: null,
      target_dream: null,
      featured: false,
    }))
  }

  // ── Com dívidas ──
  if (hasDebt) {
    list.push(mk({
      type: 'challenge',
      title: 'Plano de saída das dívidas — reorganize em 7 passos',
      description: 'Para quem está com dívidas: um plano prático e humano para retomar o controle financeiro sem milagres.',
      cta_label: 'Quero reorganizar',
      cta_url: null,
      target_dream: 'dividas',
      featured: false,
    }))
  }

  // ── Específico por sonho ──
  const dreamOpps: Record<string, Omit<OppCard, 'id' | 'isReal'>> = {
    carro: {
      type: 'event',
      title: 'Simulação gratuita: Quanto falta para você comprar seu carro?',
      description: 'Calcule exatamente quanto guardar por mês para comprar o carro que você quer no prazo certo.',
      cta_label: 'Simular agora',
      cta_url: null,
      target_dream: 'carro',
      featured: false,
    },
    casa: {
      type: 'event',
      title: 'Palestra: Como sair do aluguel com planejamento financeiro',
      description: 'Descubra as melhores estratégias para conquistar sua casa própria, mesmo com renda variável.',
      cta_label: 'Garantir minha vaga',
      cta_url: null,
      target_dream: 'casa',
      featured: false,
    },
    negocio: {
      type: 'course',
      title: 'Guia gratuito: Abra seu negócio sem entrar em dívidas',
      description: 'Passo a passo para empreender com segurança, começar com o pé direito e crescer de forma sustentável.',
      cta_label: 'Quero o guia',
      cta_url: null,
      target_dream: 'negocio',
      featured: false,
    },
    viagem: {
      type: 'challenge',
      title: 'Desafio: Guarde para sua viagem dos sonhos em 12 meses',
      description: 'Um método simples para guardar dinheiro todo mês e chegar lá sem comprometer o orçamento.',
      cta_label: 'Começar agora',
      cta_url: null,
      target_dream: 'viagem',
      featured: false,
    },
    reserva: {
      type: 'challenge',
      title: 'Desafio: Crie sua reserva de emergência em 90 dias',
      description: 'Método prático para guardar dinheiro todo mês, mesmo com orçamento apertado. Comece com R$ 50.',
      cta_label: 'Aceitar desafio',
      cta_url: null,
      target_dream: 'reserva',
      featured: false,
    },
    faculdade: {
      type: 'course',
      title: 'Como financiar sua faculdade sem comprometer o orçamento',
      description: 'Conheça todas as opções de bolsas, financiamentos e estratégias de poupança para seus estudos.',
      cta_label: 'Saber mais',
      cta_url: null,
      target_dream: 'faculdade',
      featured: false,
    },
    reforma: {
      type: 'event',
      title: 'Palestra: Planeje a reforma da sua casa sem dívidas',
      description: 'Aprenda a priorizar etapas, negociar com fornecedores e guardar para reformar sem surpresas.',
      cta_label: 'Garantir vaga',
      cta_url: null,
      target_dream: 'reforma',
      featured: false,
    },
    dividas: {
      type: 'challenge',
      title: 'Programa completo de quitação de dívidas',
      description: 'Um programa personalizado para negociar, organizar e quitar suas dívidas com tranquilidade.',
      cta_label: 'Conhecer o programa',
      cta_url: null,
      target_dream: 'dividas',
      featured: false,
    },
    moto: {
      type: 'event',
      title: 'Simulação: Quanto guardar por mês para comprar sua moto?',
      description: 'Descubra a forma mais inteligente de comprar sua moto sem pagar juros abusivos.',
      cta_label: 'Simular agora',
      cta_url: null,
      target_dream: 'moto',
      featured: false,
    },
  }

  if (dreamOpps[dream]) {
    list.push(mk(dreamOpps[dream]))
  }

  // ── Educação financeira extra ──
  list.push(mk({
    type: 'course',
    title: 'Planilha gratuita de controle financeiro mensal',
    description: 'Ferramenta simples e prática para organizar suas finanças. Baixe gratuitamente e comece hoje.',
    cta_label: 'Baixar planilha',
    cta_url: null,
    target_dream: null,
    featured: false,
  }))

  list.push(mk({
    type: 'event',
    title: 'Workshop presencial: Educação financeira na prática',
    description: 'Encontro mensal para quem quer transformar sua relação com o dinheiro. Vagas limitadas.',
    cta_label: 'Reservar vaga',
    cta_url: null,
    target_dream: null,
    featured: false,
  }))

  return list
}

// ── Página ─────────────────────────────────────────────────────────────────

export default async function OportunidadesPage({ params }: Props) {
  const { unitSlug } = await params

  // ── Sessão ──────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error()
  } catch {
    redirect(`/${unitSlug}`)
  }

  // ── Lead (valida unit_slug → impede cross-unit) ──────────────────────────
  const supabase = createServerSupabaseClient()

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, unit_id, name, main_dream, dna_progress')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) redirect(`/${unitSlug}`)

  const dream       = lead.main_dream ?? 'outro'
  const dreamInfo   = DREAM_LABELS[dream] ?? DREAM_LABELS.outro
  const firstName   = lead.name.split(' ')[0]
  const dnaProgress = lead.dna_progress ?? 0

  // ── DNA answers — personalização silenciosa ──────────────────────────────
  // Só lemos chaves específicas — respostas brutas não chegam ao client
  let hasDebt    = false
  let wantsRenda = false
  try {
    const { data: dnaData } = await supabase
      .from('dna_answers')
      .select('question_key, answer')
      .eq('lead_id', leadId!)
      .in('question_key', ['tem_dividas', 'interesse_renda_extra'])

    for (const row of dnaData ?? []) {
      if (row.question_key === 'tem_dividas' && row.answer !== 'nao') hasDebt = true
      if (row.question_key === 'interesse_renda_extra' && ['sim_urgente', 'sim_oportunidade'].includes(row.answer)) wantsRenda = true
    }
  } catch { /* fallback default: sem personalização extra */ }

  // ── Oportunidades reais do banco ─────────────────────────────────────────
  let realOpps: OppCard[] = []
  try {
    const now = new Date().toISOString()
    const { data: dbOpps } = await supabase
      .from('opportunities')
      .select('id, type, title, description, cta_label, cta_url, target_dream, featured')
      .eq('unit_id', lead.unit_id)        // ← unit_id do banco, não do browser
      .eq('active', true)
      .is('deleted_at', null)
      .or(`target_dream.is.null,target_dream.eq.${dream}`)
      .or(`starts_at.is.null,starts_at.lte.${now}`)   // período: início ok
      .or(`ends_at.is.null,ends_at.gte.${now}`)        // período: fim ok
      .order('featured', { ascending: false })
      .order('position', { ascending: true })
      .limit(20)

    realOpps = (dbOpps ?? []).map(o => ({
      id:           o.id,
      type:         o.type as OppCard['type'],
      title:        o.title,
      description:  o.description ?? '',
      cta_label:    o.cta_label ?? 'Saber mais',
      cta_url:      o.cta_url,
      target_dream: o.target_dream,
      featured:     o.featured ?? false,
      isReal:       true,
    }))
  } catch { /* DB indisponível → usa só fallback */ }

  // ── Fallback personalizado ───────────────────────────────────────────────
  const fallback = buildFallback(dream, hasDebt, wantsRenda)

  // Combina: dados reais primeiro, fallback preenche o restante
  const allOpps: OppCard[] = realOpps.length > 0
    ? [...realOpps, ...fallback]
    : fallback

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/painel`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, background: C.bgSecondary,
          color: C.textSec, textDecoration: 'none', fontSize: 18, flexShrink: 0,
        }}>←</a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>Oportunidades</div>
          <div style={{ fontSize: 11, color: C.textSec }}>Selecionadas para o seu perfil e seus objetivos.</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* ── Card de personalização ── */}
        <div style={{
          background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
          borderRadius: 18, padding: '18px', marginBottom: 16,
          boxShadow: `0 4px 24px ${C.purple}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>
              {dreamInfo.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                {firstName}, seu sonho principal
              </p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>
                {dreamInfo.label}
              </p>
            </div>
            <div style={{
              flexShrink: 0, background: 'rgba(255,255,255,0.18)',
              borderRadius: 99, padding: '4px 12px',
              fontSize: 12, fontWeight: 700, color: '#fff',
            }}>
              DNA {dnaProgress}%
            </div>
          </div>

          {/* Barra de progresso do DNA */}
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: '#fff',
              width: `${Math.max(dnaProgress, 3)}%`,
            }} />
          </div>

          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            {dnaProgress < 50
              ? '💡 Quanto mais completo seu DNA, melhores ficam suas oportunidades.'
              : '✨ Seu DNA está avançado! Oportunidades personalizadas para você abaixo.'}
          </p>
        </div>

        {/* ── Client Component (abas + cards) ── */}
        <OpportunitiesClient
          opportunities={allOpps}
          leadDream={dream}
          unitSlug={unitSlug}
          hasRealData={realOpps.length > 0}
        />

      </main>
    </div>
  )
}
