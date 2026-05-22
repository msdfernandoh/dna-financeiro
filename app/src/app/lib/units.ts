// =============================================================================
// DNA FINANCEIRO — RESOLUÇÃO DE UNIDADE
//
// Esta é a função central do isolamento multiunidade.
// Toda rota pública /[unitSlug] começa aqui.
//
// REGRA DE OURO:
//   O unit_id NUNCA vem do browser.
//   Ele é sempre resolvido pelo servidor a partir do slug da URL.
//   O browser nunca vê o unit_id — apenas dados não-sensíveis da unidade.
// =============================================================================

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Unit, UnitPublic } from '@/types/database'

/**
 * Busca a unidade pelo slug e retorna o registro completo.
 * Chama notFound() automaticamente se a unidade não existir ou estiver inativa.
 *
 * Esta função usa service_role e roda EXCLUSIVAMENTE no servidor.
 * Nunca chame em Client Components.
 *
 * @param slug - ex: "sinop", "sorriso", "lucas-do-rio-verde"
 * @returns Unit completa (com unit_id para uso interno do servidor)
 */
export async function resolveUnit(slug: string): Promise<Unit> {
  // Sanitiza o slug antes de qualquer query
  // Aceita somente letras minúsculas, números e hífens
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(slug)) {
    notFound()
  }

  const supabase = createServerSupabaseClient()

  const { data: unit, error } = await supabase
    .from('units')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (error || !unit) {
    // Não diferenciar "não existe" de "inativo" — mesmo 404 para ambos
    // Evita enumeração de unidades por clientes externos
    notFound()
  }

  return unit as Unit
}

/**
 * Converte Unit completa em UnitPublic — seguro para passar para Client Components.
 *
 * IMPORTANTE: unit_id NÃO está em UnitPublic.
 * O unit_id só circula dentro do servidor (Route Handlers, Server Actions).
 * O browser nunca recebe o UUID da unidade.
 */
export function toPublicUnit(unit: Unit): UnitPublic {
  return {
    id: unit.id,         // mantido para uso interno — não serializar para o client
    name: unit.name,
    slug: unit.slug,
    city: unit.city,
    state: unit.state,
    logo_url: unit.logo_url,
    primary_color: unit.primary_color,
  }
}

/**
 * Busca campanha pelo slug dentro de uma unidade.
 * Retorna null se não existir (campanha é opcional na rota).
 *
 * @param unitId  - UUID da unidade (já resolvido pelo servidor)
 * @param slug    - ex: "casa-propria", "renda-extra"
 */
export async function resolveCampaign(
  unitId: string,
  slug: string,
): Promise<{ id: string; name: string; slug: string; headline: string | null } | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(slug)) {
    return null
  }

  const supabase = createServerSupabaseClient()

  const { data } = await supabase
    .from('campaigns')
    .select('id, name, slug, headline')
    .eq('unit_id', unitId)
    .eq('slug', slug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  return data ?? null
}
