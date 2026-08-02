import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import MandatForm from '../MandatForm'

async function getProperties(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_properties')
    .select('id, title')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function NouveauMandatPage() {
  const session    = await getBizSession()
  const properties = await getProperties(session.account.id)

  return <MandatForm properties={properties} />
}
