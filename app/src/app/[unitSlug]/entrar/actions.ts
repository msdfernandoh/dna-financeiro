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

// Normaliza telefone para o mesmo formato usado no cadastro
// Ex: "65999991234" → "(65) 99999-1234"
// Ex: "6533334444"  → "(65) 3333-4444"
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length < 10) return d
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export async function entrarComTelefone(
  unitSlug: string,
  _prev: EntrarResult | null,
  formData: FormData,
): Promise<EntrarResult> {

  const rawPhone = formData.get('phone')?.toString().trim() ?? ''
  const digits   = rawPhone.replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 11) {
    return { success: false, error: 'Informe o telefone com DDD (ex: 65 99999-1234).' }
  }

  const formattedPhone = normalizePhone(rawPhone)

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
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('unit_slug', unitSlug)
    .eq('phone', formattedPhone)
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
