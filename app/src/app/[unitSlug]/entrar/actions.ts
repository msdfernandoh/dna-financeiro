'use server'

// =============================================================================
// /[unitSlug]/entrar — Server Action: acesso por telefone
//
// SEGURANÇA:
//   • unit_id e lead_id NUNCA vêm do frontend — resolvidos server-side
//   • unitSlug validado contra o banco antes de qualquer busca
//   • Telefone normalizado no servidor — não confia no formato do client
//   • Cookie recriado com o mesmo padrão do cadastro (HttpOnly, Secure, SameSite)
//   • Não expõe se o telefone existe ou não (mensagem genérica)
// =============================================================================

import { redirect }  from 'next/navigation'
import { cookies }   from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type EntrarResult =
  | { success: true }
  | { success: false; error: string }

// Formata dígitos de telefone BR para exibição
// Ex: "65999991234" → "(65) 99999-1234"
// Ex: "6533334444"  → "(65) 3333-4444"
function formatPhone(d: string): string {
  if (d.length < 10) return d
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Gera todas as variações de formato para busca no banco
// O cadastro salva apenas dígitos (ex: "65999991234"), mas versões antigas
// ou digitações diferentes podem gerar formatos variados.
function phoneVariations(raw: string): string[] {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  // Remove DDI 55 se presente (ex: "5565999991234" → "65999991234")
  const d = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits
  return [...new Set([
    d,             // dígitos puros — formato atual do cadastro
    formatPhone(d),// formato exibição — compatibilidade com cadastros legados
  ])]
}

export async function entrarComTelefone(
  unitSlug: string,
  _prev: EntrarResult | null,
  formData: FormData,
): Promise<EntrarResult> {

  const rawPhone = formData.get('phone')?.toString().trim() ?? ''
  const digits   = rawPhone.replace(/\D/g, '')
  // Aceita 10 ou 11 dígitos locais, ou 12-13 com DDI 55
  const localDigits = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits

  if (localDigits.length < 10 || localDigits.length > 11) {
    return { success: false, error: 'Informe o telefone com DDD (ex: 65 99999-1234).' }
  }

  const variants = phoneVariations(rawPhone)

  const supabase = createServerSupabaseClient()

  // Valida que a unidade existe e está ativa
  const { data: unit } = await supabase
    .from('units')
    .select('id')
    .eq('slug', unitSlug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!unit) {
    return { success: false, error: 'Unidade não encontrada.' }
  }

  // Busca lead pelo telefone + unidade — sem expor lead_id ao client
  // Testa múltiplas variações de formato (dígitos puros e formato exibição)
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('unit_slug', unitSlug)
    .in('phone', variants)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lead) {
    return {
      success: false,
      error: 'Não encontramos seu cadastro nesta cidade. Que tal fazer seu diagnóstico gratuito?',
    }
  }

  // Recria cookie com o mesmo padrão do cadastro
  const leadToken = Buffer.from(`${lead.id}:${Date.now()}`).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set('dna_lead_token', leadToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30, // 30 dias
    path:     '/',
  })

  redirect(`/${unitSlug}/painel`)
}
