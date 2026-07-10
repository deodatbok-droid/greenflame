import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoutureWorkshop from './CoutureClient'
import ToolGate from '@/components/merchant/ToolGate'

export default async function CouturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, is_platform_hub')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/merchant/activate')

  const { data: toolSub } = await supabase
    .from('tool_subscriptions')
    .select('expires_at')
    .eq('merchant_id', merchant.id)
    .eq('tool_slug', 'couture')
    .maybeSingle()

  const hasSubscription = merchant.is_platform_hub || (toolSub ? new Date(toolSub.expires_at) > new Date() : false)

  if (!hasSubscription) {
    return (
      <ToolGate
        toolSlug="couture"
        toolName="Couture & Mode"
        toolIcon="🪡"
        toolDescription="Gérez vos clients, leurs mensurations, vos commandes et essayage virtuel."
        features={['Fiches clients avec mensurations', 'Suivi des commandes & bons de livraison', 'Calculateur de tissu', 'Essayage virtuel 2D']}
        monthlyPrice={10000}
        annualPrice={100000}
      />
    )
  }

  const [clientsRes, commandesRes, accessoiresRes] = await Promise.all([
    supabase
      .from('couture_clients')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('full_name'),
    supabase
      .from('couture_commandes')
      .select('*, couture_clients(full_name, phone), couture_commande_accessoires(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('couture_accessoires')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('name'),
  ])

  return (
    <CoutureWorkshop
      merchantId={merchant.id}
      businessName={merchant.business_name}
      initialClients={clientsRes.data ?? []}
      initialCommandes={commandesRes.data ?? []}
      initialAccessoires={accessoiresRes.data ?? []}
    />
  )
}
