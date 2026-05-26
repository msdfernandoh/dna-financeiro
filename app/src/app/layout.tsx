import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/app/components/ServiceWorkerRegistrar'

// ── Viewport (separado de Metadata no Next.js 14+) ────────────────────────────
export const viewport: Viewport = {
  themeColor:    '#7F77DD',
  width:         'device-width',
  initialScale:  1,
  minimumScale:  1,
  viewportFit:   'cover',
}

// ── Metadata global ───────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default:  'DNA Financeiro',
    template: '%s | DNA Financeiro',
  },
  description: 'Consultor financeiro com IA para controle de despesas, investimentos, educação financeira e realização de sonhos.',

  // Manifest → habilita instalação PWA
  manifest: '/manifest.webmanifest',

  // Apple Web App (iOS Safari)
  appleWebApp: {
    capable:         true,
    title:           'DNA',
    statusBarStyle:  'default',
  },

  // Evita que o iOS ligue para números detectados na tela
  formatDetection: { telephone: false },

  // Ícones (favicon + apple-touch-icon)
  icons: {
    icon:  [{ url: '/pwa-icon?size=192', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/pwa-icon?size=192', type: 'image/png', sizes: '192x192' }],
  },

  // Open Graph básico
  openGraph: {
    title:       'DNA Financeiro',
    description: 'Consultor financeiro com IA para controle de despesas, investimentos e realização de sonhos.',
    type:        'website',
    locale:      'pt_BR',
  },
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Registra o Service Worker apenas no cliente, silenciosamente */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
