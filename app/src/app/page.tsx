import { redirect } from 'next/navigation'

// Rota raiz — em produção será uma landing nacional.
// No MVP 1 redireciona para a unidade piloto para facilitar testes.
export default function HomePage() {
  redirect('/sinop')
}
