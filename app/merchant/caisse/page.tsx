import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CaisseClient from './CaisseClient'

export default async function CaissePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  return <CaisseClient merchantId={merchant.id} businessName={merchant.business_name} />
}
