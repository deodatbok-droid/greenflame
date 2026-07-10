import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import PosClient from './PosClient'

export default async function PosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, commission_rate')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  return (
    <PosClient
      merchantId={merchant.id}
      businessName={merchant.business_name}
      commissionRate={merchant.commission_rate}
    />
  )
}
