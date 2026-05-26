// =============================================================================
// /pwa-icon — Gerador dinâmico de ícones PNG para o PWA
//
// Serve os ícones referenciados no manifest e nas tags <link>.
// Não cacheia dados sensíveis — é apenas arte estática.
//
// Uso:
//   /pwa-icon         → 512×512
//   /pwa-icon?size=192 → 192×192
//   /pwa-icon?size=512 → 512×512
// =============================================================================

import { ImageResponse }  from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get('size') ?? '512'
  const size = raw === '192' ? 192 : 512

  return new ImageResponse(
    (
      <div
        style={{
          width:           size,
          height:          size,
          background:      'linear-gradient(145deg, #7F77DD 0%, #4C1D95 100%)',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        {/* Ícone 🧬 simulado com texto, já que ImageResponse não suporta emoji perfeitamente */}
        <div
          style={{
            color:       '#ffffff',
            fontSize:    Math.round(size * 0.38),
            fontWeight:  800,
            lineHeight:  1,
            letterSpacing: -2,
            display:     'flex',
          }}
        >
          DNA
        </div>
        <div
          style={{
            color:      'rgba(255,255,255,0.75)',
            fontSize:   Math.round(size * 0.088),
            fontWeight: 500,
            marginTop:  Math.round(size * 0.03),
            display:    'flex',
            letterSpacing: 1,
          }}
        >
          Financeiro
        </div>
      </div>
    ),
    {
      width:  size,
      height: size,
      headers: {
        // Cache longo — é apenas arte estática (não contém dados)
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    },
  )
}
