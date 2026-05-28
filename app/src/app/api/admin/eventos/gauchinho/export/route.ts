// =============================================================================
// GET /api/admin/eventos/gauchinho/export
//
// Exporta leads do evento gauchinho_construtora em formato .xlsx.
//
// SEGURANÇA:
//   • requireAdmin() — sessão válida obrigatória
//   • masterOnly — apenas master pode exportar
//   • Filtra OBRIGATORIAMENTE:
//       consent_share_builder = true
//       deleted_at IS NULL
//       event_key = 'gauchinho_construtora'
//
// XLSX gerado com XML + zip via sistema nativo (Node.js + sistema zip).
// Não depende de biblioteca externa.
// =============================================================================

import { NextResponse }               from 'next/server'
import { redirect }                   from 'next/navigation'
import { execSync }                   from 'child_process'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join }                       from 'path'
import { tmpdir }                     from 'os'
import { randomUUID }                 from 'crypto'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Tipo ──────────────────────────────────────────────────────────────────────

type EventLeadRow = {
  id:                          string
  name:                        string
  whatsapp:                    string
  city:                        string | null
  empreendimento:              string | null
  torre:                       string | null
  apartamento:                 string | null
  valor_imovel:                number | null
  valor_entrega:               number | null
  valor_entrada_disponivel:    number | null
  renda_aproximada:            number | null
  precisa_financiamento:       boolean | null
  interesse_consorcio:         boolean | null
  interesse_carta_contemplada: boolean | null
  interesse_credito:           boolean | null
  interesse_plano_pontual:     boolean | null
  melhor_horario_contato:      string | null
  observacoes:                 string | null
  consent_share_builder:       boolean
  created_at:                  string
}

// ── Helpers XLSX ──────────────────────────────────────────────────────────────

type CellValue = string | number | boolean | null | undefined

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function colLetter(n: number): string {
  let s = ''
  let i = n + 1
  while (i > 0) {
    const r = (i - 1) % 26
    s = String.fromCharCode(65 + r) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

function cell(col: number, row: number, val: CellValue): string {
  const ref = `${colLetter(col)}${row}`
  if (val === null || val === undefined || val === '') {
    return `<c r="${ref}" t="inlineStr"><is><t></t></is></c>`
  }
  if (typeof val === 'number') return `<c r="${ref}"><v>${val}</v></c>`
  const str = typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val)
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(str)}</t></is></c>`
}

function sheetXml(headers: string[], rows: CellValue[][]): string {
  const rowsXml = [
    `<row r="1">${headers.map((h, i) => cell(i, 1, h)).join('')}</row>`,
    ...rows.map((r, ri) =>
      `<row r="${ri + 2}">${r.map((v, ci) => cell(ci, ri + 2, v)).join('')}</row>`,
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`
}

function buildXlsx(headers: string[], rows: CellValue[][]): Buffer {
  const uid     = randomUUID()
  const dir     = join(tmpdir(), `xlsx-${uid}`)
  const outFile = join(tmpdir(), `export-${uid}.xlsx`)

  try {
    mkdirSync(join(dir, '_rels'),          { recursive: true })
    mkdirSync(join(dir, 'xl', '_rels'),    { recursive: true })
    mkdirSync(join(dir, 'xl', 'worksheets'), { recursive: true })

    writeFileSync(join(dir, '[Content_Types].xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`)

    writeFileSync(join(dir, '_rels', '.rels'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)

    writeFileSync(join(dir, 'xl', 'workbook.xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Leads Construtora" sheetId="1" r:id="rId1"/></sheets>
</workbook>`)

    writeFileSync(join(dir, 'xl', '_rels', 'workbook.xml.rels'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`)

    writeFileSync(join(dir, 'xl', 'styles.xml'),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills>
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`)

    writeFileSync(join(dir, 'xl', 'worksheets', 'sheet1.xml'), sheetXml(headers, rows))

    execSync(`cd "${dir}" && zip -r "${outFile}" .`, { stdio: 'pipe' })
    return readFileSync(outFile)
  } finally {
    try { rmSync(dir,     { recursive: true, force: true }) } catch { /* ignore */ }
    try { rmSync(outFile, { force: true }) }                  catch { /* ignore */ }
  }
}

function fmtBool(v: boolean | null): string {
  if (v === null) return ''
  return v ? 'Sim' : 'Não'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await requireAdmin()
  if (session.role !== 'master') {
    redirect('/admin')
  }

  // ── Query — filtra obrigatoriamente por consent + deleted + event_key ─────
  const supabase = createServerSupabaseClient()

  const { data: rawLeads, error } = await supabase
    .from('event_leads')
    .select([
      'id', 'name', 'whatsapp', 'city', 'empreendimento', 'torre', 'apartamento',
      'valor_imovel', 'valor_entrega', 'valor_entrada_disponivel', 'renda_aproximada',
      'precisa_financiamento', 'interesse_consorcio', 'interesse_carta_contemplada',
      'interesse_credito', 'interesse_plano_pontual',
      'melhor_horario_contato', 'observacoes', 'consent_share_builder', 'created_at',
    ].join(', '))
    .eq('event_key', 'gauchinho_construtora')
    .eq('consent_share_builder', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar leads.' }, { status: 500 })
  }

  const leads = (rawLeads ?? []) as EventLeadRow[]

  // ── Colunas do Excel ──────────────────────────────────────────────────────
  const HEADERS = [
    'Data cadastro',
    'Nome',
    'CPF',
    'WhatsApp',
    'Cidade',
    'Empreendimento',
    'Torre / Bloco',
    'Apartamento',
    'Valor imóvel (R$)',
    'Valor entrega / chaves (R$)',
    'Valor disponível (R$)',
    'Renda aproximada (R$)',
    'Financiamento',
    'Consórcio',
    'Carta contemplada',
    'Crédito',
    'Plano Pontual',
    'Melhor horário',
    'Observações',
    'Autorizado construtora',
  ]

  const rows = leads.map(l => [
    fmtDate(l.created_at),
    l.name,
    (l as Record<string, unknown>).cpf as string ?? '',
    l.whatsapp,
    l.city           ?? '',
    l.empreendimento ?? '',
    l.torre          ?? '',
    l.apartamento    ?? '',
    l.valor_imovel          ?? '',
    l.valor_entrega         ?? '',
    l.valor_entrada_disponivel ?? '',
    l.renda_aproximada      ?? '',
    fmtBool(l.precisa_financiamento),
    fmtBool(l.interesse_consorcio),
    fmtBool(l.interesse_carta_contemplada),
    fmtBool(l.interesse_credito),
    fmtBool(l.interesse_plano_pontual),
    l.melhor_horario_contato ?? '',
    l.observacoes            ?? '',
    'Sim',
  ] as CellValue[])

  // ── Build .xlsx ───────────────────────────────────────────────────────────
  let buffer: Buffer
  try {
    buffer = buildXlsx(HEADERS, rows)
  } catch (e) {
    console.error('[export xlsx]', e)
    return NextResponse.json({ error: 'Erro ao gerar arquivo.' }, { status: 500 })
  }

  const today    = new Date().toISOString().split('T')[0]
  const filename = `leads-evento-gauchinho-construtora-${today}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.length),
    },
  })
}
