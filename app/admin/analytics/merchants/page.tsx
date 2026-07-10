import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MerchantAnalyticsClient from './MerchantAnalyticsClient'

export const metadata = { title: 'Analytics Marchands — Admin GreenFlame' }

export default async function MerchantAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile?.role?.includes('admin')) redirect('/dashboard')

  const service = createServiceClient()

  const [
    { count: totalMerchants },
    { count: proMerchants },
    { count: activatedSector },
    { count: totalOnboarding },
    { data: sectorAnalytics },
    { data: challengesAnalytics },
    { data: merchantsRaw },
  ] = await Promise.all([
    service.from('merchants').select('*', { count: 'exact', head: true }),
    service.from('merchants').select('*', { count: 'exact', head: true }).in('subscription_tier', ['pro', 'vip']),
    service.from('merchants').select('*', { count: 'exact', head: true }).not('sector_activated_at', 'is', null),
    service.from('merchant_onboarding_responses').select('*', { count: 'exact', head: true }),
    service.from('v_sector_analytics').select('*'),
    service.from('v_challenges_analytics').select('*'),
    service.from('merchants')
      .select(`
        id, business_name, subscription_tier, sector, sector_activated_at, created_at,
        users!user_id ( email, full_name ),
        merchant_onboarding_responses ( client_type, avg_basket, monthly_volume, main_challenges, seniority, tool_activated )
      `)
      .not('sector', 'is', null)
      .order('sector_activated_at', { ascending: false })
      .limit(100),
  ])

  const merchants = (merchantsRaw ?? []).map((m: any) => ({
    id: m.id,
    business_name: m.business_name,
    subscription_tier: m.subscription_tier,
    sector: m.sector,
    sector_activated_at: m.sector_activated_at,
    created_at: m.created_at,
    user: {
      email: m.users?.email ?? null,
      name: m.users?.full_name ?? null,
    },
    onboarding_response: Array.isArray(m.merchant_onboarding_responses)
      ? (m.merchant_onboarding_responses[0] ?? null)
      : null,
  }))

  return (
    <MerchantAnalyticsClient
      kpis={{
        totalMerchants: totalMerchants ?? 0,
        proMerchants: proMerchants ?? 0,
        activatedSector: activatedSector ?? 0,
        totalOnboarding: totalOnboarding ?? 0,
        activationRate: (proMerchants ?? 0) > 0
          ? Math.round(((activatedSector ?? 0) / (proMerchants ?? 0)) * 100)
          : 0,
      }}
      sectorAnalytics={(sectorAnalytics ?? []).map((row: any) => ({
        ...row,
        total_responses: Number(row.total_responses),
        activated_count: Number(row.activated_count),
        activation_rate_pct: Number(row.activation_rate_pct),
        b2c_count: Number(row.b2c_count),
        b2b_count: Number(row.b2b_count),
        mixed_count: Number(row.mixed_count),
      }))}
      challengesAnalytics={(challengesAnalytics ?? []).map((row: any) => ({
        ...row,
        mention_count: Number(row.mention_count),
        pct_of_merchants: Number(row.pct_of_merchants),
      }))}
      merchants={merchants}
    />
  )
}
