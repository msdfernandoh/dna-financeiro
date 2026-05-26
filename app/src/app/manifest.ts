// =============================================================================
// Web App Manifest — DNA Financeiro
//
// Permite instalação como PWA (Add to Home Screen) em Android e iOS.
// Serve em /manifest.webmanifest (gerado automaticamente pelo Next.js).
// =============================================================================

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'DNA Financeiro',
    short_name:       'DNA',
    description:      'Consultor financeiro com IA para controle de despesas, investimentos, educação financeira e realização de sonhos.',
    start_url:        '/',
    scope:            '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#7F77DD',
    orientation:      'portrait',
    lang:             'pt-BR',
    categories:       ['finance', 'lifestyle'],
    icons: [
      {
        src:     '/pwa-icon?size=192',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/pwa-icon?size=512',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/pwa-icon?size=512',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
