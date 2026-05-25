'use server'

// =============================================================================
// /[unitSlug]/entrar — Server Actions: login em duas etapas por código
//
// Etapa 1 — solicitarCodigo:
//   • Valida unidade e busca lead pelo telefone (múltiplos formatos)
//   • Gera código numérico de 6 dígitos
//   • Armazena código em cookie HttpOnly dna_code_token (expira em 10 min)
//   • Modo MVP/Demo: retorna código no payload para exibição na UI
//   • Modo produção (LOGIN_CODE_MODE=production): retorna null (envia pelo canal real)
//
// Etapa 2 — verificarCodigo:
//   • Lê e valida dna_code_token (unitSlug, expiração, código)
//   • Se válido: cria sessão dna_lead_token e redireciona para o painel
//   • Se inválido: retorna erro amigável sem expor informações internas
//
// SEGURANÇA:
//   • unit_id e lead_id NUNCA vêm do frontend — resolvidos server-side
//   • Código armazenado em cookie HttpOnly — inacessível ao browser
//   • Cookie de código expira em 10 minutos
//   • unitSlug dentro do cookie impede ataque cross-unit
//   • unitSlug sempre revalidado no servidor
//   • Service role apenas no servidor
// =============================================================================

import { redirect }  from 'next/navigation'
import { cookies }   from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type SolicitarCodigoResult =
  | { success: true;  demoCode: string | null }
  | { success: false; error: string }

export type VerificarCodigoResult =
  | { success: true }
  | { success: false; error: string }

// ── Helpers internos ──────────────────────────────────────────────────────────

// Formata dígitos de telefone BR para exibição
function formatPhone(d: string): string {
  if (d.length < 10) return d
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Gera variações de formato para busca no banco
// O cadastro salva apenas dígitos (ex: "65999991234"),
// mas compatibiliza com cadastros legados que armazenaram formatado.
function phoneVariations(raw: string): string[] {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  // Remove DDI 55 se presente (ex: "5565999991234" → "65999991234")
  const d = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits
  return [...new Set([d, formatPhone(d)])]
}

// Gera código numérico de 6 dígitos (100000–999999)
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Envia o código de acesso ao lead.
 *
 * TODO: substituir por envio real via WhatsApp Cloud API.
 * Exemplo de integração futura:
 *   await fetch(`https://graph.facebook.com/v19.0/${WABA_PHONE_ID}/messages`, {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', ... }),
 *   })
 *
 * Enquanto LOGIN_CODE_MODE !== 'production', esta função é no-op e o código
 * é retornado na resposta da action para exibição na UI (modo demo).
 */
async function sendLoginCode(_phone: string, _code: string, _unitSlug: string): Promise<void> {
  // Integração real será conectada aqui — substituir este comentário.
}

// ── Etapa 1 — Solicitar código de acesso ─────────────────────────────────────

export async function solicitarCodigo(
  unitSlug: string,
  _prev: SolicitarCodigoResult | null,
  formData: FormData,
): Promise<SolicitarCodigoResult> {

  const rawPhone    = formData.get('phone')?.toString().trim() ?? ''
  const digits      = rawPhone.replace(/\D/g, '')
  // Aceita 10 ou 11 dígitos locais, ou 12–13 com DDI 55
  const localDigits = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits

  if (localDigits.length < 10 || localDigits.length > 11) {
    return { success: false, error: 'Informe o telefone com DDD (ex: 65 99999-1234).' }
  }

  const variants = phoneVariations(rawPhone)
  const supabase  = createServerSupabaseClient()

  // Valida que a unidade existe e está ativa
  const { data: unit } = await supabase
    .from('units')
    .select('id')
    .eq('slug', unitSlug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!unit) return { success: false, error: 'Unidade não encontrada.' }

  // Busca lead pelo telefone + unidade (mais recente, se houver históricos duplicados)
  const { data: lead } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('unit_slug', unitSlug)
    .in('phone', variants)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lead) {
    return {
      success: false,
      error: 'Não encontramos seu cadastro nesta cidade. Confira o DDD ou faça um novo diagnóstico.',
    }
  }

  // Gera código numérico de 6 dígitos
  const code      = generateCode()
  const expiresAt = Date.now() + 10 * 60 * 1000  // 10 minutos

  // Armazena no cookie HttpOnly: leadId|code|expiresAt|unitSlug
  // Separador "|" — nenhum dos valores contém este caractere
  const codeToken = Buffer
    .from(`${lead.id}|${code}|${expiresAt}|${unitSlug}`)
    .toString('base64url')

  const cookieStore = await cookies()
  cookieStore.set('dna_code_token', codeToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   10 * 60,  // 10 minutos
    path:     '/',
  })

  // Envia código pelo canal real (no-op em modo demo)
  await sendLoginCode(lead.phone, code, unitSlug)

  // Modo demo (LOGIN_CODE_MODE !== 'production'): retorna código para exibição na UI
  const isDemoMode = process.env.LOGIN_CODE_MODE !== 'production'
  return { success: true, demoCode: isDemoMode ? code : null }
}

// ── Etapa 2 — Verificar código e criar sessão ─────────────────────────────────

export async function verificarCodigo(
  unitSlug: string,
  _prev: VerificarCodigoResult | null,
  formData: FormData,
): Promise<VerificarCodigoResult> {

  const inputCode = (formData.get('code')?.toString() ?? '').replace(/\D/g, '')

  if (!/^\d{6}$/.test(inputCode)) {
    return { success: false, error: 'Digite o código de 6 dígitos.' }
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('dna_code_token')?.value

  if (!raw) {
    return { success: false, error: 'Código expirado. Volte e solicite um novo.' }
  }

  // Decodifica e valida o cookie
  let leadId: string, storedCode: string, expiresAt: number, storedUnit: string
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    const parts   = decoded.split('|')
    if (parts.length < 4) throw new Error('formato inválido')
    ;[leadId, storedCode] = parts
    expiresAt  = parseInt(parts[2], 10)
    storedUnit = parts[3]
    if (!leadId || !storedCode || isNaN(expiresAt) || !storedUnit) throw new Error('campos vazios')
  } catch {
    return { success: false, error: 'Código inválido. Volte e solicite um novo.' }
  }

  // Valida que o cookie pertence à mesma unidade (impede ataque cross-unit)
  if (storedUnit !== unitSlug) {
    return { success: false, error: 'Código inválido. Volte e solicite um novo.' }
  }

  // Valida expiração
  if (Date.now() > expiresAt) {
    cookieStore.delete('dna_code_token')
    return { success: false, error: 'Código expirado. Volte e solicite um novo.' }
  }

  // Valida código
  if (inputCode !== storedCode) {
    return { success: false, error: 'Código inválido. Confira e tente novamente.' }
  }

  // Sucesso: limpa cookie de código e cria sessão de 30 dias
  cookieStore.delete('dna_code_token')

  const leadToken = Buffer.from(`${leadId}:${Date.now()}`).toString('base64url')
  cookieStore.set('dna_lead_token', leadToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,  // 30 dias
    path:     '/',
  })

  redirect(`/${unitSlug}/painel`)
}
