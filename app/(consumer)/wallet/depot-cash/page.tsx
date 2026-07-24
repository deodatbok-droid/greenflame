import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DepotCashClient from './DepotCashClient'

export default async function DepotCashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('phone, full_name')
    .eq('id', user.id)
    .single()

  const phone = profile?.phone ?? ''
  const name  = profile?.full_name ?? 'Utilisateur'

  return <DepotCashClient phone={phone} name={name} />
}
