interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function DiagnosticoPage({ params }: Props) {
  const { unitSlug } = await params

  return (
    <main style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      minHeight: '100dvh',
      background: '#F5F4FB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 12 }}>
          Seu diagnóstico está sendo gerado!
        </h1>
        <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6 }}>
          Em breve você verá sua análise financeira completa para {unitSlug}.
        </p>
      </div>
    </main>
  )
}
