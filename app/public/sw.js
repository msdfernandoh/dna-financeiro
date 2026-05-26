// =============================================================================
// DNA Financeiro — Service Worker
//
// Objetivo principal: habilitar instalação como PWA (Add to Home Screen).
// Cache: SOMENTE assets estáticos públicos (_next/static, manifest, ícones).
//
// SEGURANÇA:
//   • Dados financeiros do usuário NUNCA são cacheados.
//   • Páginas autenticadas são sempre ignoradas (pass-through).
//   • Cookies e tokens não são tocados.
//   • Respostas opaque (cross-origin sem CORS) não são cacheadas.
//   • Apenas requisições GET são processadas.
// =============================================================================

const CACHE_NAME = 'dna-static-v1'

// Rotas que NUNCA devem ser interceptadas — sempre vão para a rede
const PRIVATE_PREFIXES = [
  '/admin',
  '/painel',
  '/despesas',
  '/investimentos',
  '/relatorio',
  '/empresa',
  '/api',
  '/dna',
  '/sonhos',
]

/**
 * Retorna true se a URL pertence a uma rota privada/autenticada.
 * Em caso de dúvida, retorna true (conservador).
 */
function isPrivate(urlString) {
  try {
    const { pathname } = new URL(urlString)
    return PRIVATE_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
    )
  } catch {
    return true // URL inválida → nunca cachear
  }
}

/**
 * Retorna true apenas para assets que são seguros para cachear:
 *   • /_next/static/* — bundle gerado pelo build
 *   • /manifest.webmanifest — manifest do PWA
 *   • /pwa-icon* — ícones do PWA
 */
function isSafeToCache(urlString) {
  try {
    const { pathname } = new URL(urlString)
    return (
      pathname.startsWith('/_next/static/') ||
      pathname === '/manifest.webmanifest' ||
      pathname.startsWith('/pwa-icon')
    )
  } catch {
    return false
  }
}

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  // Ativar imediatamente (sem aguardar abas antigas fecharem)
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  // Remover caches de versões anteriores
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event

  // 1. Apenas GET
  if (request.method !== 'GET') return

  // 2. Nunca interceptar rotas privadas/autenticadas
  if (isPrivate(request.url)) return

  // 3. Nunca interceptar requisições com credenciais (cookies, tokens)
  if (request.credentials === 'include') return

  // 4. Só cachear assets estáticos seguros
  if (!isSafeToCache(request.url)) return

  // Estratégia: Cache-first, com atualização em background
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached

      return fetch(request)
        .then(response => {
          // Não cachear respostas inválidas ou opaque (cross-origin sem CORS)
          if (!response.ok || response.type === 'opaque') return response

          const clone = response.clone()
          caches
            .open(CACHE_NAME)
            .then(cache => cache.put(request, clone))
            .catch(() => {/* falha silenciosa de cache */})

          return response
        })
        .catch(() => Response.error())
    }),
  )
})
