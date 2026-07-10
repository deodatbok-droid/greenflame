import { createClient } from '@/lib/supabase/server'
import DemoClient from './DemoClient'
import type { RealChainMember } from './DemoClient'
import { getServerT } from '@/lib/i18n/server'

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { t } = await getServerT()

  // Guest mode — show fictional chain, no real transaction execution
  if (!user) {
    const guestChain: RealChainMember[] = [
      { level: 'Vous', id: null, name: t('demo.youCashback'),                                          share: 0.15 },
      { level: 'L1',   id: null, name: t('demo.guestAffiliate').replace('{n}', '1'),                   share: 0.12 },
      { level: 'L2',   id: null, name: t('demo.guestAffiliate').replace('{n}', '2'),                   share: 0.10 },
      { level: 'L3',   id: null, name: t('demo.guestAffiliate').replace('{n}', '3'),                   share: 0.08 },
      { level: 'L4',   id: null, name: t('demo.guestAffiliate').replace('{n}', '4'),                   share: 0.06 },
      { level: 'L5',   id: null, name: t('demo.guestAffiliate').replace('{n}', '5'),                   share: 0.04 },
    ]
    return (
      <DemoClient
        realChain={guestChain}
        dreamworldMerchantId={null}
        buyerId=""
        isGuest={true}
        referralCode={ref ?? null}
      />
    )
  }

  // Authenticated user — load real chain
  const [profileRes, networkTreeRes, dreamworldRes] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).single(),
    supabase.from('network_tree')
      .select('l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('merchants')
      .select('id')
      .ilike('business_name', '%dreamworld%')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const networkTree = networkTreeRes.data
  const uplineIds = [
    networkTree?.l1_upline,
    networkTree?.l2_upline,
    networkTree?.l3_upline,
    networkTree?.l4_upline,
    networkTree?.l5_upline,
  ].filter(Boolean) as string[]

  const { data: uplineUsers } = uplineIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', uplineIds)
    : { data: [] }

  const uplineMap = Object.fromEntries((uplineUsers ?? []).map(u => [u.id, u.full_name]))

  const noAffiliate = t('demo.noAffiliate')

  const realChain: RealChainMember[] = [
    { level: 'Vous', id: user.id,                          name: profileRes.data?.full_name ?? t('demo.youCashback'),                                                    share: 0.15 },
    { level: 'L1',   id: networkTree?.l1_upline ?? null,   name: networkTree?.l1_upline ? (uplineMap[networkTree.l1_upline] ?? 'L1') : noAffiliate, share: 0.12 },
    { level: 'L2',   id: networkTree?.l2_upline ?? null,   name: networkTree?.l2_upline ? (uplineMap[networkTree.l2_upline] ?? 'L2') : noAffiliate, share: 0.10 },
    { level: 'L3',   id: networkTree?.l3_upline ?? null,   name: networkTree?.l3_upline ? (uplineMap[networkTree.l3_upline] ?? 'L3') : noAffiliate, share: 0.08 },
    { level: 'L4',   id: networkTree?.l4_upline ?? null,   name: networkTree?.l4_upline ? (uplineMap[networkTree.l4_upline] ?? 'L4') : noAffiliate, share: 0.06 },
    { level: 'L5',   id: networkTree?.l5_upline ?? null,   name: networkTree?.l5_upline ? (uplineMap[networkTree.l5_upline] ?? 'L5') : noAffiliate, share: 0.04 },
  ]

  return (
    <DemoClient
      realChain={realChain}
      dreamworldMerchantId={dreamworldRes.data?.id ?? null}
      buyerId={user.id}
      isGuest={false}
      referralCode={null}
    />
  )
}
