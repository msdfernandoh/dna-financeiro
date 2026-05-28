// =============================================================================
// PATCH /api/admin/eventos/gauchinho/leads/[id]/situacao
//
// Atualiza o campo situacao de um lead do evento gauchinho_construtora.
//
// SEGURANÇA:
//   • requireAdmin() — sessão válida obrigatória
//   • masterOnly — apenas master pode alterar
//   • Valida que o lead pertence a gauchinho_construtora
//   • Valida enum de situacao no servidor
// =============================================================================

import { NextResponse }               from 'next/server'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_SITUACOES = [
  'enviar_proposta',
  'proposta_enviada',
  'aguardando_documentacao',
  'documentacao_enviada',
  'aprovado',
] as const

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await requireAdmin().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.role !== 'master') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const situacao = body.situacao
  if (typeof situacao !== 'string' || !(VALID_SITUACOES as readonly string[]).includes(situacao)) {
    return NextResponse.json({ error: 'Situação inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Valida que o lead pertence ao evento correto
  const { data: lead } = await supabase
    .from('event_leads')
    .select('id')
    .eq('id', id)
    .eq('event_key', 'gauchinho_construtora')
    .is('deleted_at', null)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  const { error } = await supabase
    .from('event_leads')
    .update({ situacao })
    .eq('id', id)

  if (error) {
    console.error('[situacao update]', error)
    return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, situacao })
}
