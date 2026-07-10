import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonClient from './SalonClient'
import ToolGate from '@/components/merchant/ToolGate'

export default async function SalonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/merchant/activate')

  const { data: toolSub } = await supabase
    .from('tool_subscriptions')
    .select('expires_at')
    .eq('merchant_id', merchant.id)
    .eq('tool_slug', 'salon')
    .maybeSingle()

  const hasSubscription = merchant.is_platform_hub || (toolSub ? new Date(toolSub.expires_at) > new Date() : false)

  if (!hasSubscription) {
    return (
      <ToolGate
        toolSlug="salon"
        toolName="Salon & Beauté"
        toolIcon="✂️"
        toolDescription="Gérez vos produits, calculez vos marges et pilotez vos prestations beauté."
        features={['Bibliothèque de produits & coûts', 'Calcul de marge par prestation', 'Suivi de vos charges réelles']}
        monthlyPrice={10000}
        annualPrice={100000}
      />
    )
  }

  const [productsRes, prestationsRes] = await Promise.all([
    supabase
      .from('salon_products')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('salon_prestations')
      .select('*, salon_prestation_products(quantity_used, salon_products(id, name, unit, package_quantity, package_cost_fcfa))')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <SalonClient
      merchantId={merchant.id}
      businessName={merchant.business_name}
      initialProducts={productsRes.data ?? []}
      initialPrestations={prestationsRes.data ?? []}
    />
  )
}
