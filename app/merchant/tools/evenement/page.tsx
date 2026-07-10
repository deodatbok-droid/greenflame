import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UniversalDevisClient from '@/components/tools/UniversalDevisClient'
import { SECTOR_CONFIGS } from '@/lib/tools/sector-configs'

export default async function EvenementToolPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, subscription_tier')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/merchant/activate')

  const isPro = ['pro', 'vip'].includes(merchant.subscription_tier ?? '')

  return (
    <UniversalDevisClient
      config={SECTOR_CONFIGS.evenement}
      businessName={merchant.business_name ?? ''}
      isPro={isPro}
    />
  )
}
