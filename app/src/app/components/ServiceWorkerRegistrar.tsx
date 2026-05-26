'use client'
// =============================================================================
// ServiceWorkerRegistrar — registra /sw.js no cliente, silenciosamente.
//
// Renderiza null (sem output visual).
// Executa apenas uma vez (useEffect sem deps).
// Falha silenciosa se o browser não suportar SW.
// =============================================================================

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => { /* falha silenciosa — não afeta a experiência */ })
  }, [])

  return null
}
