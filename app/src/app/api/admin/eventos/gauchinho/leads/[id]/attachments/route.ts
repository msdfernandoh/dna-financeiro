// =============================================================================
// GET  /api/admin/eventos/gauchinho/leads/[id]/attachments
// POST /api/admin/eventos/gauchinho/leads/[id]/attachments   (multipart/form-data)
// DELETE /api/admin/eventos/gauchinho/leads/[id]/attachments?attachmentId=...
//
// Gerencia anexos de um lead via Supabase Storage.
//
// SEGURANÇA:
//   • requireAdmin() — sessão válida obrigatória
//   • masterOnly — apenas master pode gerenciar anexos
//   • Lead validado por id + event_key
//   • Upload server-side com service_role (nunca direto do browser)
//   • Bucket: event-attachments (privado) — criar no painel Supabase
//   • Signed URLs com 1h de expiração
// =============================================================================

import { NextResponse }               from 'next/server'
import { randomUUID }                 from 'crypto'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const BUCKET      = 'event-attachments'
const MAX_BYTES   = 20 * 1024 * 1024   // 20 MB
const SIGNED_SECS = 3_600               // 1 hora

async function resolveAuth() {
  const session = await requireAdmin().catch(() => null)
  if (!session) return { session: null, error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (session.role !== 'master') return { session: null, error: NextResponse.json({ error: 'Sem permissão.' }, { status: 403 }) }
  return { session, error: null }
}

// ── GET — lista anexos + signed URLs ─────────────────────────────────────────

export async function GET(_req: Request, { params }: RouteContext) {
  const { session, error } = await resolveAuth()
  if (!session) return error!

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('event_leads').select('id')
    .eq('id', id).eq('event_key', 'gauchinho_construtora').is('deleted_at', null).single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  const { data: rows, error: dbErr } = await supabase
    .from('event_lead_attachments')
    .select('id, filename, storage_path, size_bytes, content_type, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: 'Erro ao buscar anexos.' }, { status: 500 })

  // Gera signed URLs em paralelo
  const attachments = await Promise.all(
    (rows ?? []).map(async row => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_SECS)
      return { ...row, signed_url: signed?.signedUrl ?? null }
    }),
  )

  return NextResponse.json({ attachments })
}

// ── POST — upload de arquivo ──────────────────────────────────────────────────

export async function POST(req: Request, { params }: RouteContext) {
  const { session, error } = await resolveAuth()
  if (!session) return error!

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('event_leads').select('id')
    .eq('id', id).eq('event_key', 'gauchinho_construtora').is('deleted_at', null).single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'Nenhum arquivo.' }, { status: 400 })
  if (file.size > MAX_BYTES)    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 20 MB.' }, { status: 400 })

  const ext         = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const storagePath = `event-leads/${id}/${randomUUID()}.${ext}`
  const buffer      = Buffer.from(await file.arrayBuffer())

  // Cria o bucket se ainda não existe (idempotente)
  await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES })

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadErr) {
    console.error('[attachment upload]', uploadErr)
    return NextResponse.json({ error: 'Erro ao enviar arquivo.' }, { status: 500 })
  }

  const { data: inserted, error: dbErr } = await supabase
    .from('event_lead_attachments')
    .insert({
      lead_id:      id,
      filename:     file.name,
      storage_path: storagePath,
      size_bytes:   file.size,
      content_type: file.type || null,
      uploaded_by:  session.profileId,
    })
    .select('id, filename, storage_path, size_bytes, content_type, created_at')
    .single()

  if (dbErr || !inserted) {
    // Reverte o upload se a inserção falhar
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: 'Erro ao salvar anexo.' }, { status: 500 })
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_SECS)

  return NextResponse.json({ attachment: { ...inserted, signed_url: signed?.signedUrl ?? null } })
}

// ── DELETE — remove arquivo ───────────────────────────────────────────────────

export async function DELETE(req: Request, { params }: RouteContext) {
  const { session, error } = await resolveAuth()
  if (!session) return error!

  const { id } = await params
  const url    = new URL(req.url)
  const attId  = url.searchParams.get('attachmentId')
  if (!attId) return NextResponse.json({ error: 'attachmentId obrigatório.' }, { status: 400 })

  const supabase = createServerSupabaseClient()

  // Valida que o lead pertence ao evento e que o anexo pertence ao lead
  const { data: lead } = await supabase
    .from('event_leads').select('id')
    .eq('id', id).eq('event_key', 'gauchinho_construtora').is('deleted_at', null).single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  const { data: att } = await supabase
    .from('event_lead_attachments')
    .select('id, storage_path')
    .eq('id', attId)
    .eq('lead_id', id)
    .single()

  if (!att) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([att.storage_path])

  const { error: dbErr } = await supabase
    .from('event_lead_attachments')
    .delete()
    .eq('id', attId)

  if (dbErr) return NextResponse.json({ error: 'Erro ao remover anexo.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
