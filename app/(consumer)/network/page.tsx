import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NetworkClient from '@/components/consumer/NetworkClient'
import BackButton from '@/components/ui/BackButton'
import Link from 'next/link'
import { getServerT } from '@/lib/i18n/server'
import CercleUplineCard from '@/components/messaging/CercleUplineCard'
import Palier2Messaging from '@/components/messaging/Palier2Messaging'

export default async function NetworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t } = await getServerT()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Fetch everything in parallel: profile, counts, member IDs, commissions
  const [
    profileRes,
    palier2TxRes,
    c1, c2, c3, c4, c5,
    t1, t2, t3, t4, t5,
    commissionsRes,
  ] = await Promise.all([
    supabase.from('users').select('referral_code, kyc_level').eq('id', user.id).single(),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('status', 'completed'),
    supabase.from('network_tree').select('*', { count: 'exact', head: true }).eq('l1_upline', user.id),
    supabase.from('network_tree').select('*', { count: 'exact', head: true }).eq('l2_upline', user.id),
    supabase.from('network_tree').select('*', { count: 'exact', head: true }).eq('l3_upline', user.id),
    supabase.from('network_tree').select('*', { count: 'exact', head: true }).eq('l4_upline', user.id),
    supabase.from('network_tree').select('*', { count: 'exact', head: true }).eq('l5_upline', user.id),
    supabase.from('network_tree').select('user_id').eq('l1_upline', user.id).limit(20),
    supabase.from('network_tree').select('user_id').eq('l2_upline', user.id).limit(20),
    supabase.from('network_tree').select('user_id').eq('l3_upline', user.id).limit(20),
    supabase.from('network_tree').select('user_id').eq('l4_upline', user.id).limit(20),
    supabase.from('network_tree').select('user_id').eq('l5_upline', user.id).limit(20),
    supabase
      .from('commission_distributions')
      .select('level, amount_fcfa')
      .eq('recipient_id', user.id)
      .eq('distribution_type', 'network')
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  // Resolve member details + career rank + merchant status for each level
  async function resolveMembers(treeRows: { user_id: string }[] | null) {
    if (!treeRows || treeRows.length === 0) return []
    const ids = treeRows.map(r => r.user_id)
    const [{ data: users }, { data: ranks }, { data: merchants }] = await Promise.all([
      supabase.from('users').select('id, full_name, created_at, role, enrolled_by_id').in('id', ids).order('created_at', { ascending: false }),
      supabase.from('leader_career_ranks').select('user_id, current_rank').in('user_id', ids),
      supabase.from('merchants').select('user_id, subscription_tier').in('user_id', ids),
    ])
    const rankMap     = new Map((ranks ?? []).map(r => [r.user_id, r.current_rank]))
    const merchantMap = new Map((merchants ?? []).map(m => [m.user_id, m.subscription_tier]))
    return (users ?? []).map(u => ({
      id:           u.id,
      full_name:    u.full_name,
      created_at:   u.created_at,
      currentRank:  rankMap.get(u.id) ?? 0,
      isDirect:     !!user && u.enrolled_by_id === user.id,
      isMerchant:   (u.role ?? []).includes('merchant'),
      merchantTier: merchantMap.get(u.id) ?? null,
    }))
  }

  const l1Ids = (t1.data ?? []).map(r => r.user_id)

  async function getSubCounts(): Promise<Record<string, number>> {
    if (l1Ids.length === 0) return {}
    const { data } = await supabase.from('network_tree').select('l1_upline').in('l1_upline', l1Ids)
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      if (row.l1_upline) counts[row.l1_upline] = (counts[row.l1_upline] ?? 0) + 1
    }
    return counts
  }

  const [members1, members2, members3, members4, members5, memberSubCounts] = await Promise.all([
    resolveMembers(t1.data),
    resolveMembers(t2.data),
    resolveMembers(t3.data),
    resolveMembers(t4.data),
    resolveMembers(t5.data),
    getSubCounts(),
  ])

  // Commission totals by level
  const byLevel: Record<number, number> = {}
  for (const c of commissionsRes.data ?? []) {
    byLevel[c.level] = (byLevel[c.level] ?? 0) + c.amount_fcfa
  }

  const counts = [c1.count ?? 0, c2.count ?? 0, c3.count ?? 0, c4.count ?? 0, c5.count ?? 0]
  const allMembers = [members1, members2, members3, members4, members5]

  const levels = [1, 2, 3, 4, 5].map((level, i) => ({
    level,
    count: counts[i],
    earnings30d: byLevel[level] ?? 0,
    members: allMembers[i],
  }))

  const totalCount = counts.reduce((s, c) => s + c, 0)
  const totalEarnings30d = Object.values(byLevel).reduce((s, v) => s + v, 0)
  const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'}/register?ref=${profileRes.data?.referral_code}`
  const eligiblePalier2 = (profileRes.data?.kyc_level ?? 0) >= 1 && (palier2TxRes.count ?? 0) >= 1

  return (
    <div>
      <div className="px-4 pt-10 pb-2 flex items-center">
        <BackButton href="/dashboard" />
      </div>

      {/* ── Raccourci Tontines ── */}
      <div className="px-4 pb-3">
        <Link href="/tontine">
          <div className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-800 rounded-2xl px-4 py-3 text-white hover:from-brand-700 hover:to-brand-900 transition-all">
            <span className="text-3xl">🤝</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none">{t('tontine.title')}</p>
              <p className="text-brand-200 text-xs mt-0.5">{t('network.tontineDesc')}</p>
            </div>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-brand-300 flex-shrink-0">
              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
            </svg>
          </div>
        </Link>
      </div>

      {/* ── Cercle de l'upline direct (Palier 1 messagerie) ── */}
      <div className="px-4 pb-3">
        <CercleUplineCard />
      </div>

      {/* ── Recherche + invitation plateforme (Palier 2 messagerie) ── */}
      {eligiblePalier2 && (
        <div className="px-4 pb-3">
          <Palier2Messaging />
        </div>
      )}

      <NetworkClient
        levels={levels}
        totalEarnings30d={totalEarnings30d}
        passifMois={totalEarnings30d}
        referralUrl={referralUrl}
        totalCount={totalCount}
        memberSubCounts={memberSubCounts}
        l1Total={c1.count ?? 0}
      />
    </div>
  )
}
