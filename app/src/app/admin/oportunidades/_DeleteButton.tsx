'use client'

// Client Component necessário para usar onSubmit (event handler) com Server Action.
// Padrão Next.js: Server Action é bound no Server Component e passado como prop.

import { C } from '@/app/components/ui'

interface Props {
  action: () => Promise<void>
}

export function DeleteOppButton({ action }: Props) {
  return (
    <form
      action={action}
      onSubmit={e => {
        if (!confirm('Remover esta oportunidade? Esta ação não pode ser desfeita.')) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        style={{
          border: `1px solid ${C.coralBg}`, borderRadius: 8,
          padding: '5px 12px', fontSize: 12,
          cursor: 'pointer', background: C.coralBg, color: C.coral,
          fontFamily: 'inherit', fontWeight: 500,
        }}
      >
        🗑 Remover
      </button>
    </form>
  )
}
