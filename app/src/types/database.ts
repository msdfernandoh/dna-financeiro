// =============================================================================
// DNA FINANCEIRO — TIPOS DO BANCO DE DADOS
// Gerado manualmente alinhado com o schema do Supabase SQL Final
// =============================================================================

// ---------------------------------------------------------------------------
// Tabela: units
// ---------------------------------------------------------------------------

export type UnitPlan = 'basic' | 'standard' | 'premium'

export type UnitStatus = 'active' | 'paused' | 'cancelled'
export type BillingPlan = 'gratis' | 'piloto' | 'mensal' | 'anual' | 'franquia'

export interface Unit {
  id: string
  name: string
  slug: string
  subdomain: string | null
  city: string
  state: string
  plan: UnitPlan
  active: boolean
  unit_status: UnitStatus       // status operacional: active | paused | cancelled
  billing_plan: BillingPlan     // plano comercial/contratual
  notes: string | null          // observações internas (só master)
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
  | { success: false; error: string; field?: string; duplicate?: boolean }

// ---------------------------------------------------------------------------
// Resposta da Server Action de criação de despesa
// ---------------------------------------------------------------------------

export type CreateExpenseResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Resposta da Server Action de criação de investimento
// ---------------------------------------------------------------------------

export type CreateInvestmentResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Respostas das Server Actions de edição e exclusão de despesas/investimentos
// ---------------------------------------------------------------------------

export type UpdateExpenseResult =
  | { success: true }
  | { success: false; error: string; field?: string }

export type UpdateInvestmentResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Resposta da Server Action de DNA Financeiro
// ---------------------------------------------------------------------------

export type SaveDnaResult =
  | { success: true;  nextStage: number }
  | { success: false; error: string }

// Registro de resposta DNA — subset para o Client Component
export interface DnaAnswerRecord {
  step_key:     string
  question_key: string
  answer:       string
  answer_type:  string
}

// ---------------------------------------------------------------------------
// Admin: Sessão autenticada (espelho de AdminSession em lib/supabase/admin.ts)
// Definido aqui também para uso nos tipos de Server Actions sem circular dep
// ---------------------------------------------------------------------------

export type OppType = 'event' | 'course' | 'challenge' | 'job' | 'banner' | 'partner'

export interface OpportunityAdmin {
  id:           string
  unit_id:      string
  type:         OppType
  title:        string
  description:  string | null
  cta_label:    string | null
  cta_url:      string | null
  target_dream:   string | null
  target_profile: string | null   // null = para todos; valor = perfil empresarial alvo
  featured:       boolean
  active:       boolean
  position:     number
  starts_at:    string | null   // ISO UTC — null = sem restrição de início
  ends_at:      string | null   // ISO UTC — null = sem prazo de expiração
  created_at:   string
  deleted_at:   string | null
}

// Status de período calculado em runtime (não persistido no banco)
export type OppPeriodStatus = 'no-period' | 'scheduled' | 'active' | 'expired'

// Resultado das Server Actions admin de oportunidades
export type AdminOppResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ---------------------------------------------------------------------------
// Respostas das Server Actions de sonhos
// ---------------------------------------------------------------------------

export type UpdateDreamResult =
  | { success: true }
  | { success: false; error: string; field?: string }

export type CreateDreamResult =
  | { success: true }
  | { success: false; error: string; field?: string }

export type MarkDreamAchievedResult =
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

// ---------------------------------------------------------------------------
// Perfil Empresarial (business_profiles)
// ---------------------------------------------------------------------------

// State do Server Action saveBusinessProfile — redirect on success, error on fail
export type SaveBusinessProfileState = { error: string } | null

export interface BusinessProfile {
  id: string
  unit_id: string
  lead_id: string
  business_name: string | null
  segment: string | null
  activity_years: string | null
  formalization: string | null
  employee_count: string | null
  monthly_revenue: number | null        // ⚠️ sensível
  monthly_biz_expenses: number | null   // ⚠️ sensível
  monthly_profit: number | null         // ⚠️ sensível
  has_rent: boolean | null
  rent_amount: number | null            // ⚠️ sensível
  premise_type: string | null
  wants_own_premise: boolean | null
  monthly_premise_budget: number | null // ⚠️ sensível
  has_vehicles: boolean | null
  vehicle_types: string | null
  vehicle_count: string | null
  vehicle_ownership: string | null
  wants_fleet_renewal: boolean | null
  monthly_fleet_budget: number | null   // ⚠️ sensível
  needs_working_capital: boolean | null
  working_capital_amount: number | null  // ⚠️ sensível
  working_capital_purpose: string | null
  has_collateral_asset: boolean | null
  collateral_type: string | null
  collateral_value: number | null       // ⚠️⚠️ muito sensível
  needs_equipment: boolean | null
  needs_renovation: boolean | null
  needs_hiring: boolean | null
  needs_marketing: boolean | null
  needs_financial_org: boolean | null
  has_separate_accounts: boolean | null
  biz_dna_progress: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}
