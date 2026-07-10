import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevisClient from './DevisClient'

export default async function DevisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, subscription_tier, subscription_expires_at')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const tier = merchant.subscription_tier ?? 'free'
  const expires = merchant.subscription_expires_at
    ? new Date(merchant.subscription_expires_at)
    : null
  const isPro = tier !== 'free' && expires !== null && expires > new Date()

  // Free et Pro/VIP ont accès — Free est limité à 5/mois (géré côté client)
  return <DevisClient businessName={merchant.business_name} isPro={isPro} />
}
