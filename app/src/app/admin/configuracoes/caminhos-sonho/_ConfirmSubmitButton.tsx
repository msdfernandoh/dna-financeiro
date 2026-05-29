'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string
  children:     ReactNode
}

export function ConfirmSubmitButton({ confirmMessage, children, ...props }: Props) {
  return (
    <button
      type="submit"
      {...props}
      onClick={e => {
        if (!confirm(confirmMessage)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
