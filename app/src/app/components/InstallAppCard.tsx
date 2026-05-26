'use client'
// =============================================================================
// InstallAppCard — orienta o usuário a instalar o DNA Financeiro como PWA.
//
// Android Chrome: usa o evento beforeinstallprompt (botão "Instalar agora").
// iPhone Safari:  exibe instruções manuais (compartilhar → Adicionar à Tela).
// Já instalado:   não renderiza nada (detecta display-mode: standalone).
// Dispensado:     salva flag em localStorage; não aparece novamente.
//
// SEGURANÇA: não usa localStorage para dados financeiros.
//            apenas salva flag de dismissal ('dna_pwa_dismissed').
// =============================================================================

import { useEffect, useState } from 'react'
import { C } from '@/app/components/ui'

// Interface para o evento não-padrão do Chrome
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios'

const DISMISS_KEY = 'dna_pwa_dismissed'

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform]           = useState<Platform | null>(null)
  const [visible, setVisible]             = useState(false)

  useEffect(() => {
    // 1. Já está rodando como PWA instalado → não mostrar
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari expõe window.navigator.standalone (não-padrão)
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // 2. Usuário já dispensou → não mostrar
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch { /* localStorage indisponível */ }

    // 3. Detectar iOS Safari
    //    (exclui Chrome iOS / Firefox iOS que têm seu próprio fluxo)
    const ua = navigator.userAgent
    if (
      /iPhone|iPad|iPod/i.test(ua) &&
      /Safari/i.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
    ) {
      setPlatform('ios')
      setVisible(true)
      return
    }

    // 4. Ouvir evento do Android Chrome (beforeinstallprompt)
    const handlePrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setPlatform('android')
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setInstallPrompt(null)
    }
  }

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { }
    setVisible(false)
  }

  if (!visible || platform === null) return null

  return (
    <div style={{
      background:    '#fff',
      borderRadius:  16,
      padding:       '14px 16px',
      marginBottom:  10,
      border:        `0.5px solid ${C.border}`,
    }}>
      {/* Cabeçalho com ícone, texto e botão fechar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width:           40,
          height:          40,
          borderRadius:    12,
          background:      C.purpleBg,
          flexShrink:      0,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        20,
        }}>📲</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 3px' }}>
            Instale o DNA Financeiro no seu celular
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
            Acesse como app, lance despesas mais rápido e acompanhe seu dia financeiro.
          </p>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      C.textTer,
            fontSize:   20,
            lineHeight: 1,
            padding:    '0 2px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Android Chrome — botão nativo de instalação */}
      {platform === 'android' && installPrompt && (
        <button
          onClick={handleInstall}
          style={{
            width:        '100%',
            background:   C.purple,
            color:        '#fff',
            border:       'none',
            borderRadius: 10,
            padding:      '12px 20px',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            gap:          6,
          }}
        >
          📲 Instalar agora
        </button>
      )}

      {/* iPhone Safari — instrução manual */}
      {platform === 'ios' && (
        <div style={{
          background:   C.purpleBg,
          borderRadius: 10,
          padding:      '10px 12px',
        }}>
          <p style={{ fontSize: 12, color: C.purpleDeep, margin: 0, lineHeight: 1.6 }}>
            Toque em{' '}
            <strong>Compartilhar</strong>
            {' '}(
            <span style={{ fontSize: 14 }}>⎋</span>
            ) na barra inferior do Safari e depois em{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
