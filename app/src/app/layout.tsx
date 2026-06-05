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
    default:  'DNA Financeiro — Consultor Financeiro Gratuito para Realizar Seus Sonhos',
    template: '%s | DNA Financeiro',
  },
  description: 'Controle suas despesas pessoais, organize suas finanças e receba oportunidades locais para economizar. Consultor financeiro gratuito que te ajuda a realizar seus sonhos.',
  keywords: [
    'controle financeiro gratuito',
    'consultor financeiro',
    'organizar finanças pessoais',
    'economizar dinheiro',
    'realizar sonhos',
    'oportunidades locais',
  ],
  robots: {
    index:  true,
    follow: true,
  },

  // URL canônica
  alternates: {
    canonical: 'https://dnafinanceiro.app.br/',
  },

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

  // Open Graph
  openGraph: {
    title:       'DNA Financeiro — Seu Consultor Financeiro Gratuito',
    description: 'Organize suas finanças pessoais, controle despesas e receba oportunidades para economizar e realizar seus sonhos.',
    url:         'https://dnafinanceiro.app.br/',
    type:        'website',
    locale:      'pt_BR',
    siteName:    'DNA Financeiro',
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
