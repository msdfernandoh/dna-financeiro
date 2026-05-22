import { resolveUnit, toPublicUnit } from '@/lib/units'
import { createLead } from '@/lib/actions'
import { RegisterForm } from '../components/RegisterForm'

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function UnitPage({ params }: Props) {
  const { unitSlug } = await params
  const unit = await resolveUnit(unitSlug)
  const publicUnit = toPublicUnit(unit)

  const createLeadAction = createLead.bind(null, unit.slug, unit.id)

  return <RegisterForm unit={publicUnit} createLeadAction={createLeadAction} />
}
