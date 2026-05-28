'use server'

// =============================================================================
// Server Action — Cadastro de lead no evento Gauchinho x Construtora
//
// SEGURANÇA:
//   • unit_id NUNCA vem do browser — resolvido via resolveUnit(slug) no servidor
//   • ip_address e user_agent capturados pelos headers HTTP (servidor)
//   • Tabela event_leads separada de public.leads — sem mistura
//   • RLS ativo: service_role bypassa, anon key é rejeitada (sem policy pública)
// =============================================================================

import { headers }                   from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveUnit }                from '@/lib/units'

// ── Tipo do estado retornado ao Client Component ──────────────────────────────

export type EventoFormState =
  | { success: true }
  | { success: false; error: string; field?: string }
  | null

// ── Helper: string → número ou null ──────────────────────────────────────────

function parseNumeric(val: FormDataEntryValue | null): number | null {
  if (!val || typeof val !== 'string') return null
  // Remove R$, pontos de milhar, aceita vírgula como decimal
  const clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) || n < 0 ? null : n
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function submitEventoLead(
  unitSlug: string,
  prevState: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  try {
    // unit_id resolvido no servidor — nunca vem do browser
    const unit = await resolveUnit(unitSlug)

    // ── Campos obrigatórios ────────────────────────────────────────────────────
    const name     = (formData.get('name')     as string ?? '').trim()
    const whatsapp = (formData.get('whatsapp') as string ?? '').replace(/\D/g, '')

    if (!name || name.length < 2) {
      return { success: false, error: 'Nome é obrigatório.', field: 'name' }
    }
    if (whatsapp.length < 10 || whatsapp.length > 11) {
      return { success: false, error: 'WhatsApp inválido. Informe DDD + número.', field: 'whatsapp' }
    }

    // ── CPF (opcional) ────────────────────────────────────────────────────────
    const cpfRaw = (formData.get('cpf') as string ?? '').replace(/\D/g, '')
    const cpf    = cpfRaw.length === 11 ? cpfRaw : cpfRaw.length === 0 ? null : null
    // CPF parcial (1-10 dígitos) é silenciosamente descartado (não é erro de cadastro)

    // ── Dados do imóvel ────────────────────────────────────────────────────────
    const empreendimento = (formData.get('empreendimento') as string ?? '').trim() || null
    const torre          = (formData.get('torre')          as string ?? '').trim() || null
    const apartamento    = (formData.get('apartamento')    as string ?? '').trim() || null

    const valor_imovel             = parseNumeric(formData.get('valor_imovel'))
    const valor_entrega            = parseNumeric(formData.get('valor_entrega'))
    const valor_entrada_disponivel = parseNumeric(formData.get('valor_entrada_disponivel'))
    const renda_aproximada         = parseNumeric(formData.get('renda_aproximada'))

    // ── Interesses ────────────────────────────────────────────────────────────
    const precisa_financiamento       = formData.get('precisa_financiamento')       === 'true'
    const interesse_consorcio         = formData.get('interesse_consorcio')         === 'true'
    const interesse_carta_contemplada = formData.get('interesse_carta_contemplada') === 'true'
    const interesse_credito           = formData.get('interesse_credito')           === 'true'
    const interesse_plano_pontual     = formData.get('interesse_plano_pontual')     === 'true'

    // ── Preferências ──────────────────────────────────────────────────────────
    const melhor_horario_contato = (formData.get('melhor_horario_contato') as string ?? '').trim() || null
    const observacoes            = (formData.get('observacoes')            as string ?? '').trim() || null

    // ── LGPD — consent_contact é obrigatório ─────────────────────────────────
    const consent_contact       = formData.get('consent_contact')       === 'true'
    const consent_share_builder = formData.get('consent_share_builder') === 'true'

    if (!consent_contact) {
      return {
        success: false,
        error:   'Você precisa autorizar o contato para finalizar o cadastro.',
        field:   'consent_contact',
      }
    }

    // ── Rastreio técnico (servidor) ───────────────────────────────────────────
    const hdrs      = await headers()
    const ip_address = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
                    ?? hdrs.get('x-real-ip')
                    ?? null
    const user_agent = hdrs.get('user-agent') ?? null
    const source_page = hdrs.get('referer')   ?? null

    // ── Inserção ──────────────────────────────────────────────────────────────
    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('event_leads')
      .insert({
        unit_id:                      unit.id,
        event_key:                    'gauchinho_construtora',
        name,
        whatsapp,
        cpf,
        empreendimento,
        torre,
        apartamento,
        valor_imovel,
        valor_entrega,
        valor_entrada_disponivel,
        renda_aproximada,
        precisa_financiamento,
        interesse_consorcio,
        interesse_carta_contemplada,
        interesse_credito,
        interesse_plano_pontual,
        melhor_horario_contato,
        observacoes,
        consent_share_builder,
        consent_contact,
        source_page,
        ip_address,
        user_agent,
      })

    if (error) {
      console.error('[evento/actions] Supabase insert error:', error.message)
      return { success: false, error: 'Erro ao salvar. Tente novamente em instantes.' }
    }

    return { success: true }

  } catch (err) {
    console.error('[evento/actions] Unexpected error:', err)
    return { success: false, error: 'Erro inesperado. Tente novamente.' }
  }
}
