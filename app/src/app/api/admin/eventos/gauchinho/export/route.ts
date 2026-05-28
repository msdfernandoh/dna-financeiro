// =============================================================================
// GET /api/admin/eventos/gauchinho/export
//
// Gera e devolve um arquivo .xlsx com os leads do evento Gauchinho x Construtora.
//
// SEGURANÇA:
//   • requireAdmin() — redireciona para /admin/login se não autenticado
//   • masterOnly — retorna 403 se role !== 'master'
//   • Filtra SEMPRE:
//       event_key = 'gauchinho_construtora'
//       consent_share_builder = true   (⚠️ LGPD — nunca exportar sem consentimento)
//       deleted_at IS NULL
//
// RESPOSTA:
//   Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
//   Content-Disposition: attachment; filename="leads_gauchinho_YYYY-MM-DD.xlsx"
// =============================================================================

import { NextResponse }               from 'next/server'
import ExcelJS                        from 'exceljs'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { EventLead }             from '@/types/database'

// ── Colunas do relatório ──────────────────────────────────────────────────────

const COLUMNS = [
  { header: 'Data de Cadastro',           key: 'created_at',                width: 20 },
  { header: 'Nome',                        key: 'name',                      width: 30 },
  { header: 'WhatsApp',                    key: 'whatsapp',                  width: 18 },
  { header: 'Empreendimento',              key: 'empreendimento',            width: 25 },
  { header: 'Torre / Bloco',               key: 'torre',                     width: 14 },
  { header: 'Apartamento',                 key: 'apartamento',               width: 14 },
  { header: 'Valor do Imóvel (R$)',        key: 'valor_imovel',              width: 20, style: 'currency' },
  { header: 'Valor de Entrega (R$)',       key: 'valor_entrega',             width: 20, style: 'currency' },
  { header: 'Entrada Disponível (R$)',     key: 'valor_entrada_disponivel',  width: 22, style: 'currency' },
  { header: 'Renda Aproximada (R$)',       key: 'renda_aproximada',          width: 20, style: 'currency' },
  { header: 'Precisa Financiamento?',      key: 'precisa_financiamento',     width: 22, style: 'bool' },
  { header: 'Interesse Consórcio?',        key: 'interesse_consorcio',       width: 22, style: 'bool' },
  { header: 'Interesse Carta Contempl.?',  key: 'interesse_carta_contemplada', width: 25, style: 'bool' },
  { header: 'Interesse Crédito?',          key: 'interesse_credito',         width: 20, style: 'bool' },
  { header: 'Interesse Plano Pontual?',    key: 'interesse_plano_pontual',   width: 24, style: 'bool' },
  { header: 'Melhor Horário de Contato',   key: 'melhor_horario_contato',    width: 24 },
  { header: 'Observações',                 key: 'observacoes',               width: 40 },
  { header: 'Consentiu Compartilhamento?', key: 'consent_share_builder',     width: 28, style: 'bool' },
  { header: 'Consentiu Contato?',          key: 'consent_contact',           width: 20, style: 'bool' },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function boolLabel(v: boolean): string {
  return v ? 'Sim' : 'Não'
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Cuiaba',
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // ── Autenticação ─────────────────────────────────────────────────────────
    const session = await requireAdmin()

    // masterOnly
    if (session.role !== 'master') {
      return NextResponse.json({ error: 'Acesso restrito a administradores master.' }, { status: 403 })
    }

    // ── Query: SEMPRE filtra consent_share_builder = true (LGPD) ─────────────
    const supabase = createServerSupabaseClient()

    const { data: rawLeads, error: dbError } = await supabase
      .from('event_leads')
      .select(`
        created_at, name, whatsapp,
        empreendimento, torre, apartamento,
        valor_imovel, valor_entrega, valor_entrada_disponivel, renda_aproximada,
        precisa_financiamento, interesse_consorcio,
        interesse_carta_contemplada, interesse_credito, interesse_plano_pontual,
        melhor_horario_contato, observacoes,
        consent_share_builder, consent_contact
      `)
      .eq('event_key', 'gauchinho_construtora')
      .eq('consent_share_builder', true)        // ⚠️ LGPD — nunca exportar sem consentimento
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[export/gauchinho] DB error:', dbError.message)
      return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 })
    }

    const leads = (rawLeads ?? []) as Partial<EventLead>[]

    // ── Workbook ExcelJS ──────────────────────────────────────────────────────
    const workbook  = new ExcelJS.Workbook()
    workbook.creator = 'DNA Financeiro · Gauchinho'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Leads Evento', {
      views: [{ state: 'frozen', ySplit: 1 }],  // congela linha de cabeçalho
    })

    // ── Colunas ───────────────────────────────────────────────────────────────
    sheet.columns = COLUMNS.map(col => ({
      header:   col.header,
      key:      col.key,
      width:    col.width,
    }))

    // ── Estilo do cabeçalho ───────────────────────────────────────────────────
    const headerRow = sheet.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.font       = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F8A' } }
      cell.alignment  = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border     = {
        bottom: { style: 'medium', color: { argb: 'FF0F3060' } },
      }
    })

    // ── Linhas de dados ───────────────────────────────────────────────────────
    leads.forEach((lead, idx) => {
      const row = sheet.addRow({
        created_at:                 lead.created_at ? fmtDateTime(lead.created_at) : '—',
        name:                       lead.name ?? '',
        whatsapp:                   lead.whatsapp ?? '',
        empreendimento:             lead.empreendimento ?? '',
        torre:                      lead.torre ?? '',
        apartamento:                lead.apartamento ?? '',
        valor_imovel:               lead.valor_imovel ?? '',
        valor_entrega:              lead.valor_entrega ?? '',
        valor_entrada_disponivel:   lead.valor_entrada_disponivel ?? '',
        renda_aproximada:           lead.renda_aproximada ?? '',
        precisa_financiamento:      boolLabel(lead.precisa_financiamento ?? false),
        interesse_consorcio:        boolLabel(lead.interesse_consorcio ?? false),
        interesse_carta_contemplada: boolLabel(lead.interesse_carta_contemplada ?? false),
        interesse_credito:          boolLabel(lead.interesse_credito ?? false),
        interesse_plano_pontual:    boolLabel(lead.interesse_plano_pontual ?? false),
        melhor_horario_contato:     lead.melhor_horario_contato ?? '',
        observacoes:                lead.observacoes ?? '',
        consent_share_builder:      boolLabel(lead.consent_share_builder ?? false),
        consent_contact:            boolLabel(lead.consent_contact ?? false),
      })

      // Fundo zebra
      const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4F8'
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.alignment = { vertical: 'middle', wrapText: false }
        cell.font = { size: 11 }
      })
    })

    // ── Linha de rodapé (total + aviso LGPD) ─────────────────────────────────
    sheet.addRow([])

    const noteRow = sheet.addRow([''])
    noteRow.getCell(1).value =
      `Gerado em: ${fmtDateTime(new Date().toISOString())} · ` +
      `Total: ${leads.length} leads · ` +
      `Filtro aplicado: consent_share_builder = true (LGPD) · ` +
      `Evento: Gauchinho × Construtora · DNA Financeiro`
    sheet.mergeCells(`A${noteRow.number}:S${noteRow.number}`)
    noteRow.getCell(1).font      = { italic: true, color: { argb: 'FF94A3B8' }, size: 9 }
    noteRow.getCell(1).alignment = { horizontal: 'left' }

    // ── Serializar e retornar ─────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer()

    const today    = new Date().toISOString().split('T')[0]
    const filename = `leads_gauchinho_${today}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })

  } catch (err) {
    console.error('[export/gauchinho] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro inesperado ao gerar exportação.' }, { status: 500 })
  }
}
