import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BtpClient from './BtpClient'
import ToolGate from '@/components/merchant/ToolGate'

export default async function BtpPage() {
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
    .eq('tool_slug', 'btp')
    .maybeSingle()

  const hasSubscription = merchant.is_platform_hub || (toolSub ? new Date(toolSub.expires_at) > new Date() : false)

  if (!hasSubscription) {
    return (
      <ToolGate
        toolSlug="btp"
        toolName="BTP & Artisans"
        toolIcon="🏗️"
        toolDescription="Pilotez vos chantiers, gérez vos matériaux et générez des devis IA en secondes."
        features={['Bibliothèque de matériaux & prix', 'Suivi de chantiers & budgets', 'Estimateur IA par description', 'Devis professionnel PDF']}
        monthlyPrice={10000}
        annualPrice={100000}
      />
    )
  }

  const [materiauxRes, chantiersRes] = await Promise.all([
    supabase
      .from('btp_materiaux')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('category')
      .order('name'),
    supabase
      .from('btp_chantiers')
      .select('*, btp_chantier_materiaux(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <BtpClient
      merchantId={merchant.id}
      businessName={merchant.business_name}
      initialMateriaux={materiauxRes.data ?? []}
      initialChantiers={chantiersRes.data ?? []}
    />
  )
}
