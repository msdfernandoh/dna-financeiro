'use client'

import { useState, useEffect, useRef } from 'react'
import { C } from '@/app/components/ui'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Attachment = {
  id:           string
  filename:     string
  storage_path: string
  size_bytes:   number | null
  content_type: string | null
  created_at:   string
  signed_url:   string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fileEmoji(type: string | null): string {
  if (!type) return '📄'
  if (type.startsWith('image/'))        return '🖼️'
  if (type === 'application/pdf')       return '📕'
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return '📊'
  if (type.includes('word') || type.includes('document')) return '📝'
  return '📄'
}

// ── Componente ────────────────────────────────────────────────────────────────

export function AnexosSection({ leadId }: { leadId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const BASE = `/api/admin/eventos/gauchinho/leads/${leadId}/attachments`

  async function loadAttachments() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(BASE)
      if (!res.ok) throw new Error('Erro ao carregar')
      const json = await res.json() as { attachments: Attachment[] }
      setAttachments(json.attachments ?? [])
    } catch {
      setError('Não foi possível carregar os anexos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAttachments() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch(BASE, { method: 'POST', body: fd })
      const json = await res.json() as { attachment?: Attachment; error?: string }
      if (!res.ok) { setError(json.error ?? 'Erro ao enviar.'); return }
      setAttachments((prev: Attachment[]) => [json.attachment!, ...prev])
    } catch {
      setError('Erro ao enviar o arquivo.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(attId: string, filename: string) {
    if (!window.confirm(`Remover "${filename}"?`)) return
    setDeleting(attId)
    try {
      const res = await fetch(`${BASE}?attachmentId=${attId}`, { method: 'DELETE' })
      if (!res.ok) { setError('Erro ao remover.'); return }
      setAttachments((prev: Attachment[]) => prev.filter((a: Attachment) => a.id !== attId))
    } catch {
      setError('Erro ao remover o arquivo.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `0.5px solid ${C.border}`,
      padding: '16px 18px', marginBottom: 12,
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
          📎 Anexos {attachments.length > 0 && `(${attachments.length})`}
        </p>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: C.purpleBg, color: C.purpleDeep,
          border: `1px solid ${C.purple}40`,
          borderRadius: 10, padding: '7px 14px',
          fontSize: 12, fontWeight: 600,
          cursor: uploading ? 'wait' : 'pointer',
          opacity: uploading ? 0.7 : 1,
        }}>
          {uploading ? '⏳ Enviando…' : '⬆️ Enviar arquivo'}
          <input
            ref={inputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.gif"
          />
        </label>
      </div>

      {/* Aviso de limite */}
      <p style={{ fontSize: 10, color: C.textSec, margin: '0 0 12px' }}>
        PDF, Word, Excel, imagens · Máximo 20 MB por arquivo
      </p>

      {/* Erro */}
      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FECACA',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 12, color: '#991B1B', marginBottom: 12,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#991B1B', fontWeight: 700, marginLeft: 8, fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ fontSize: 12, color: C.textSec, textAlign: 'center', margin: '16px 0' }}>
          Carregando…
        </p>
      ) : attachments.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          borderTop: `0.5px solid ${C.border}`,
        }}>
          <p style={{ fontSize: 20, margin: '0 0 4px' }}>📂</p>
          <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
            Nenhum anexo ainda.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attachments.map(att => (
            <div key={att.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: C.bgApp,
              borderRadius: 10,
              border: `0.5px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>
                {fileEmoji(att.content_type)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 500,
                  color: C.text, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {att.filename}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textSec }}>
                  {fmtSize(att.size_bytes)}{att.size_bytes ? ' · ' : ''}{fmtDate(att.created_at)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {att.signed_url && (
                  <a
                    href={att.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Baixar"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 8,
                      background: C.greenBg, border: `1px solid ${C.green}30`,
                      textDecoration: 'none', fontSize: 14,
                    }}
                  >⬇️</a>
                )}
                <button
                  onClick={() => handleDelete(att.id, att.filename)}
                  disabled={deleting === att.id}
                  title="Remover"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 8,
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    cursor: deleting === att.id ? 'wait' : 'pointer',
                    fontSize: 14, opacity: deleting === att.id ? 0.5 : 1,
                  }}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
