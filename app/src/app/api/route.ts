// =============================================================================
// DNA FINANCEIRO — API: VERIFICAR SESSÃO DO LEAD
// GET /api/leads/session
//
// Verifica se o cookie dna_lead_token é válido e retorna dados públicos do lead.
// Usado por Server Components nas próximas telas (diagnóstico, dashboard, etc.)
//
// SEGURANÇA:
//   • Lê o token do cookie HttpOnly — nunca de parâmetros da URL
//   • Resolve o lead via service_role — nunca expõe unit_id ao cliente
//   • Retorna apenas campos não-sensíveis
// =============================================================================

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const cookieStore = await cookies()
  const rawToken = cookieStore.get('dna_lead_token')?.value

  if (!rawToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Decodifica o token opaco: base64url(lead_id:timestamp)
  let leadId: string
  try {
    const decoded = Buffer.from(rawToken, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, name, main_dream, dna_progress, dna_stage, status, unit_slug, city')
    .eq('id', leadId)
    .is('deleted_at', null)
    .single()

  if (error || !lead) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Retorna apenas dados não-sensíveis — nunca monthly_income, unit_id, etc.
  return NextResponse.json({
    authenticated: true,
    lead: {
      name:         lead.name,
      main_dream:   lead.main_dream,
      dna_progress: lead.dna_progress,
      dna_stage:    lead.dna_stage,
      status:       lead.status,
      unit_slug:    lead.unit_slug,
      city:         lead.city,
    },
  })
}
