import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SectorOnboardingClient from './SectorOnboardingClient'

export const metadata = {
  title: 'Activer mon outil sectoriel — GreenFlame',
}

export default async function ActivateSectorToolPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, subscription_tier, sector, sector_activated_at')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const isPro = ['pro', 'vip'].includes(merchant.subscription_tier ?? '')

  if (merchant.sector && merchant.sector_activated_at) {
    redirect(`/merchant/tools/${merchant.sector}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pb-16">
        <SectorOnboardingClient businessName={merchant.business_name ?? ''} isPro={isPro} />
      </div>
    </div>
  )
}
