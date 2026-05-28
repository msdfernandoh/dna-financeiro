// =============================================================================
// POST /api/[unitSlug]/eventos/gauchinho/leads
//
// Salva um lead de evento na tabela event_leads.
// SEGURANÇA:
//   • unit_id resolvido server-side a partir do slug da URL (nunca do body)
//   • Validação de campos obrigatórios (name, whatsapp, consent_contact)
//   • IP salvo dos headers da requisição
//   • Não salva na tabela leads normal
// =============================================================================

import { NextResponse }           from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ unitSlug: string }>
}

function normalizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '')
}

function getIp(req: Request): string {
  const fw = req.headers.get('x-forwarded-for')
  if (fw) return fw.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? ''
}

export async function POST(req: Request, { params }: RouteContext) {
  const { unitSlug } = await params

  // ── Resolve unit_id server-side ───────────────────────────────────────────
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(unitSlug)) {
    return NextResponse.json({ error: 'Unidade inválida.' }, { status: 404 })
  }

  const supabase = createServerSupabaseClient()

  const { data: unit } = await supabase
    .from('units')
    .select('id')
    .eq('slug', unitSlug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!unit) {
    return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  // ── Validação obrigatória ─────────────────────────────────────────────────
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const whatsappRaw = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : ''
  const whatsapp = normalizeWhatsApp(whatsappRaw)
  const consentContact = body.consent_contact === true

  if (!name)            return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
  if (whatsapp.length < 10) return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 })
  if (!consentContact)  return NextResponse.json({ error: 'Consentimento de contato é obrigatório.' }, { status: 400 })

  // ── Campos opcionais ──────────────────────────────────────────────────────
  const str   = (k: string) => (typeof body[k] === 'string' && body[k] !== '' ? (body[k] as string).trim() : null)
  const num   = (k: string) => {
    const v = body[k]
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }
  const bool  = (k: string) => body[k] === true

  const payload = {
    unit_id:                     unit.id,
    event_key:                   'gauchinho_construtora',
    event_name:                  'Evento Construtora - Gauchinho',
    source_page:                 `/${unitSlug}/gauchinho/evento`,
    name,
    cpf:                         str('cpf'),
    whatsapp,
    city:                        str('city'),
    empreendimento:              str('empreendimento'),
    torre:                       str('torre'),
    apartamento:                 str('apartamento'),
    valor_imovel:                num('valor_imovel'),
    valor_entrega:               num('valor_entrega'),
    valor_entrada_disponivel:    num('valor_entrada_disponivel'),
    renda_aproximada:            num('renda_aproximada'),
    precisa_financiamento:       bool('precisa_financiamento') || null,
    interesse_consorcio:         bool('interesse_consorcio') || null,
    interesse_carta_contemplada: bool('interesse_carta_contemplada') || null,
    interesse_credito:           bool('interesse_credito') || null,
    interesse_plano_pontual:     bool('interesse_plano_pontual') || null,
    melhor_horario_contato:      str('melhor_horario_contato'),
    observacoes:                 str('observacoes'),
    consent_share_builder:       bool('consent_share_builder'),
    consent_contact:             true,
    ip_address:                  getIp(req),
    user_agent:                  req.headers.get('user-agent') ?? '',
  }

  const { error } = await supabase.from('event_leads').insert(payload)

  if (error) {
    console.error('[event_leads insert]', error)
    return NextResponse.json({ error: 'Erro ao salvar. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
