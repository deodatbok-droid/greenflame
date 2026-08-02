import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import VisitForm from '../VisitForm'

async function getProperties(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_properties')
    .select('id, title')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function getCustomers(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_customers')
    .select('id, name, phone')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  return data ?? []
}

export default async function NouvelleVisitePage() {
  const session    = await getBizSession()
  const [properties, customers] = await Promise.all([
    getProperties(session.account.id),
    getCustomers(session.account.id),
  ])

  return <VisitForm properties={properties} customers={customers} />
}
