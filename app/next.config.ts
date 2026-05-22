import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Headers de segurança HTTP
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Bloqueia o browser de expor o Referer completo para outros domínios
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Bloqueia execução de scripts inline não autorizados
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Impede que o app seja embutido em iframe de outros domínios
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },

  // Bloqueia slugs reservados de serem usados como unitSlug
  // Impede que /admin, /api, etc. caiam na rota dinâmica [unitSlug]
  async redirects() {
    const reserved = ['admin', 'master', 'api', 'auth', 'privacidade', '_next', 'static']
    return reserved.map((slug) => ({
      source: `/${slug}`,
      destination: '/',
      permanent: false,
    }))
  },
}

export default nextConfig
