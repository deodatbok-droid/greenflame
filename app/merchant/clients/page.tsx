import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientsClient from './ClientsClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  return <ClientsClient merchantId={merchant.id} />
}
