// =============================================================================
// DNA FINANCEIRO — TIPOS DO BANCO DE DADOS
// Gerado manualmente alinhado com o schema do Supabase SQL Final
// =============================================================================

// ---------------------------------------------------------------------------
// Tabela: units
// ---------------------------------------------------------------------------

export type UnitPlan = 'basic' | 'standard' | 'premium'

export interface Unit {
  id: string
  name: string
  slug: string
  subdomain: string | null
  city: string
  state: string
  plan: UnitPlan
  active: boolean
  logo_url: string | null
  primary_color: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Subset seguro para expor ao client (sem campos internos)
export interface UnitPublic {
  id: string          // necessário para relacionar no server — nunca enviar ao browser
  name: string
  slug: string
  city: string
  state: string
  logo_url: string | null
  primary_color: string | null
}

// ---------------------------------------------------------------------------
// Tabela: leads
// ---------------------------------------------------------------------------

export type LeadStatus = 'new' | 'in_progress' | 'qualified' | 'converted' | 'inactive'

export interface Lead {
  id: string
  unit_id: string
  campaign_id: string | null
  name: string
  phone: string
  email: string | null
  city: string | null
  monthly_income: number | null
  monthly_expenses: number | null
  main_dream: string | null
  consent_diagnosis: boolean
  consent_communications: boolean
  consent_analytics: boolean
  consent_at: string | null
  source_url: string
  unit_slug: string
  campaign_slug: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  device_type: string | null
  dna_progress: number
  dna_stage: number
  status: LeadStatus
  last_seen_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ---------------------------------------------------------------------------
// Formulário de cadastro — dados que vêm do browser
// unit_id NUNCA está aqui — é resolvido pelo servidor
// ---------------------------------------------------------------------------

export interface LeadCreateInput {
  name: string
  phone: string
  city: string
  monthly_income: number
  monthly_expenses: number
  main_dream: string
  consent_diagnosis: boolean
  consent_communications: boolean
}

// ---------------------------------------------------------------------------
// Contexto de rastreamento — montado pelo servidor, nunca pelo browser
// ---------------------------------------------------------------------------

export interface LeadTrackingContext {
  unit_id: string         // resolvido da rota pelo servidor
  unit_slug: string
  campaign_id: string | null
  campaign_slug: string | null
  source_url: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  device_type: string
}

// ---------------------------------------------------------------------------
// Resposta da Server Action de criação de lead
// ---------------------------------------------------------------------------

export type CreateLeadResult =
  | { success: true;  leadToken: string }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Resposta da Server Action de criação de despesa
// ---------------------------------------------------------------------------

export type CreateExpenseResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Erros de validação do formulário
// ---------------------------------------------------------------------------

export interface FormErrors {
  name?: string
  phone?: string
  city?: string
  monthly_income?: string
  monthly_expenses?: string
  main_dream?: string
  consent_diagnosis?: string
  _form?: string
}
