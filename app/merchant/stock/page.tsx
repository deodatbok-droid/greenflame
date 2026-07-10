import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StockClient from './StockClient'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, subscription_tier')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  return <StockClient merchantId={merchant.id} />
}
