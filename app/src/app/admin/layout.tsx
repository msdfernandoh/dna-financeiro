import type { ReactNode } from 'react'

export const metadata = {
  title: 'Admin · DNA Financeiro',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Layout mínimo — cada página admin renderiza seu próprio shell visual
  return <>{children}</>
}
