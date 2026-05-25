'use server'

// =============================================================================
// /admin/usuarios — Server Actions: criar, editar e resetar senha
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode criar ou editar usuários
//   • Não é permitido criar master pela tela neste MVP
//   • unit_admin e unit_viewer precisam obrigatoriamente de unit_id
//   • Senha temporária gerada no servidor — nunca aceita do FormData
//   • service_role apenas no servidor
// =============================================================================

import { redirect }               from 'next/navigation'
import { requireAdmin }           from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type UserFormResult =
  | { success: true; tempPassword?: string }
  | { success: false; error: string; field?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Gera senha temporária legível (sem ambiguidade de caracteres). */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'
  let pwd = ''
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

function parseFormData(fd: FormData) {
  const str  = (key: string) => (fd.get(key)?.toString() ?? '').trim()
  const strN = (key: string) => str(key) || null
  return {
    name:    str('name'),
    email:   str('email').toLowerCase(),
    phone:   strN('phone'),
    role:    str('role'),
    unit_id: strN('unit_id'),
    active:  fd.get('active') === 'on' || fd.get('active') === '1',
  }
}

function validateUser(
  data: ReturnType<typeof parseFormData>,
  skipRole = false,
): UserFormResult | null {
  if (!data.name || data.name.length < 2)
    return { success: false, error: 'Informe o nome do usuário.', field: 'name' }
  if (data.name.length > 120)
    return { success: false, error: 'Nome muito longo (máx. 120 caracteres).', field: 'name' }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    return { success: false, error: 'E-mail inválido.', field: 'email' }

  if (!skipRole) {
    if (!['unit_admin', 'unit_viewer'].includes(data.role))
      return { success: false, error: 'Perfil inválido.', field: 'role' }
    if (!data.unit_id)
      return { success: false, error: 'Selecione a unidade do usuário.', field: 'unit_id' }
  }

  return null
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createAdminUser(
  _prev: UserFormResult | null,
  formData: FormData,
): Promise<UserFormResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') return { success: false, error: 'Sem permissão.' }

  const data = parseFormData(formData)
  const validationError = validateUser(data)
  if (validationError) return validationError

  const supabase = createServerSupabaseClient()

  // Verifica se e-mail já existe no sistema
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', data.email)
    .is('deleted_at', null)
    .single()
  if (existingProfile)
    return { success: false, error: 'Este e-mail já está em uso.', field: 'email' }

  const tempPassword = generateTempPassword()

  // Cria usuário no Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email:         data.email,
    password:      tempPassword,
    email_confirm: true,           // confirma sem enviar e-mail
  })

  if (authErr || !authData.user) {
    console.error('[createAdminUser auth]', authErr?.message)
    if (authErr?.message?.includes('already registered'))
      return { success: false, error: 'Este e-mail já está registrado.', field: 'email' }
    return { success: false, error: 'Erro ao criar usuário. Tente novamente.' }
  }

  // Insere profile
  const { error: profileErr } = await supabase.from('profiles').insert({
    id:      authData.user.id,
    name:    data.name,
    email:   data.email,
    phone:   data.phone,
    role:    data.role as 'unit_admin' | 'unit_viewer',
    unit_id: data.unit_id,
    active:  true,
  })

  if (profileErr) {
    console.error('[createAdminUser profile]', profileErr.message)
    // Reverte o usuário criado no Auth para não deixar órfão
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Erro ao salvar perfil. Tente novamente.' }
  }

  // Retorna a senha temporária — exibida uma única vez
  return { success: true, tempPassword }
}

export async function updateAdminUser(
  userId: string,
  _prev: UserFormResult | null,
  formData: FormData,
): Promise<UserFormResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') return { success: false, error: 'Sem permissão.' }

  const data = parseFormData(formData)
  const validationError = validateUser(data)
  if (validationError) return validationError

  const supabase = createServerSupabaseClient()

  // Verifica unicidade de e-mail — ignora o próprio usuário
  const { data: dup } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', data.email)
    .neq('id', userId)
    .is('deleted_at', null)
    .single()
  if (dup) return { success: false, error: 'Este e-mail já está em uso.', field: 'email' }

  // Atualiza profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      name:    data.name,
      email:   data.email,
      phone:   data.phone,
      role:    data.role as 'unit_admin' | 'unit_viewer',
      unit_id: data.unit_id,
      active:  data.active,
    })
    .eq('id', userId)

  if (profileErr) {
    console.error('[updateAdminUser]', profileErr.message)
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  // Atualiza e-mail no Auth se mudou
  await supabase.auth.admin.updateUserById(userId, { email: data.email })

  redirect('/admin/usuarios?updated=1')
}

export async function resetAdminPassword(
  userId: string,
  _prev: UserFormResult | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<UserFormResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') return { success: false, error: 'Sem permissão.' }

  const tempPassword = generateTempPassword()

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })

  if (error) {
    console.error('[resetAdminPassword]', error.message)
    return { success: false, error: 'Erro ao resetar senha. Tente novamente.' }
  }

  return { success: true, tempPassword }
}
