// =============================================================================
// POST /api/[unitSlug]/opportunities/interactions
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do body
//   • unit_id resolvido do banco a partir do leadId + unitSlug — nunca do body
//   • opportunity_id validado: pertence à mesma unidade, ativa, não deletada
//   • interaction_type e source validados contra lista fixa
//   • metadata limitado a 1 KB
//   • service_role apenas server-side (bypassa RLS)
//   • fallback: opportunity_id = null aceito; sem tentativa de resolver no banco
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const VALID_INTERACTION_TYPES = [
  'view',
  'click',
  'interest',
  'save',
  'unsave',
  'external_link_click',  // clique em CTA com URL externa
  'contact_request',      // pedido de contato
] as const

const VALID_SOURCES = [
  'painel',         // card de destaque em /[unitSlug]/painel
  'oportunidades',  // lista em /[unitSlug]/oportunidades
  'detalhe',        // página de detalhe /[unitSlug]/oportunidades/[id]
  'fallback',       // oportunidade de fallback (sem opportunity_id)
] as const

type InteractionType = typeof VALID_INTERACTION_TYPES[number]
type Source          = typeof VALID_SOURCES[number]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitSlug: string }> },
) {
  const { unitSlug } = await params

  // ── 1. Auth: resolve lead do cookie HttpOnly ──────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid-id')
  } catch {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
  }

  // ── 2. Valida lead + cross-unit (unit_slug da URL === lead.unit_slug) ─────
  const supabase = createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, unit_id, unit_slug')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)   // ← impede cross-unit
    .is('deleted_at', null)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })
  }

  // ── 3. Parse do body ──────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const {
    opportunity_id,
    opportunity_type,
    opportunity_title,
    interaction_type,
    source,
    target_dream,
    metadata,
  } = body

  // ── 4. Validações de campos ───────────────────────────────────────────────

  if (
    typeof opportunity_title !== 'string' ||
    !opportunity_title.trim() ||
    opportunity_title.length > 300
  ) {
    return NextResponse.json({ error: 'Título inválido (máx. 300 chars).' }, { status: 400 })
  }

  if (!VALID_INTERACTION_TYPES.includes(interaction_type as InteractionType)) {
    return NextResponse.json(
      { error: `interaction_type inválido. Use: ${VALID_INTERACTION_TYPES.join(', ')}.` },
      { status: 400 },
    )
  }

  if (!VALID_SOURCES.includes(source as Source)) {
    return NextResponse.json(
      { error: `source inválido. Use: ${VALID_SOURCES.join(', ')}.` },
      { status: 400 },
    )
  }

  // ── 5. Valida opportunity_id (se fornecido) ───────────────────────────────
  //   - Deve pertencer à MESMA unidade do lead
  //   - Deve estar ativa e não deletada
  //   - Se fallback → opportunity_id é null, aceito diretamente
  let resolvedOppId: string | null = null

  if (
    opportunity_id !== null &&
    opportunity_id !== undefined &&
    typeof opportunity_id === 'string'
  ) {
    if (!/^[0-9a-f-]{36}$/.test(opportunity_id)) {
      return NextResponse.json({ error: 'opportunity_id inválido.' }, { status: 400 })
    }

    const { data: opp } = await supabase
      .from('opportunities')
      .select('id')
      .eq('id', opportunity_id)
      .eq('unit_id', lead.unit_id)   // ← cross-unit protection
      .eq('active', true)
      .is('deleted_at', null)
      .single()

    if (!opp) {
      return NextResponse.json({ error: 'Oportunidade inválida ou de outra unidade.' }, { status: 400 })
    }

    resolvedOppId = opp.id
  }

  // ── 6. Sanitiza metadata ──────────────────────────────────────────────────
  let safeMetadata: Record<string, unknown> = {}
  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata)
  ) {
    const metaStr = JSON.stringify(metadata)
    if (metaStr.length <= 1000) {
      safeMetadata = metadata as Record<string, unknown>
    }
  }

  // ── 7. Insere interação ───────────────────────────────────────────────────
  //   unit_id e lead_id SEMPRE do banco — nunca do body
  const { error } = await supabase
    .from('opportunity_interactions')
    .insert({
      unit_id:           lead.unit_id,           // ← do banco
      lead_id:           lead.id,                // ← do banco
      opportunity_id:    resolvedOppId,
      opportunity_type:  typeof opportunity_type === 'string'
                           ? opportunity_type.slice(0, 50) : null,
      opportunity_title: opportunity_title.trim().slice(0, 300),
      interaction_type:  interaction_type as InteractionType,
      source:            source as Source,
      target_dream:      typeof target_dream === 'string'
                           ? target_dream.slice(0, 50) : null,
      metadata:          safeMetadata,
    })

  if (error) {
    // ── Violação de índice único parcial: lead já demonstrou interesse nessa opp ──
    // idx_oi_unique_interest: UNIQUE (lead_id, opportunity_id) WHERE interaction_type='interest'
    // Retorna 200 amigável em vez de 500 — o lead não precisa saber do detalhe técnico
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
    console.error('[POST /api/[unitSlug]/opportunities/interactions]', error.message)
    return NextResponse.json({ error: 'Erro ao registrar interação.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
