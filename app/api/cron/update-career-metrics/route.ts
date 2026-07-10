import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateCareerMetrics, CAREER_RANKS } from '@/lib/career/engine'

// Vercel Cron — 3h00 UTC = 4h00 Cotonou
// Recalcule les métriques carrière de tous les utilisateurs actifs

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: users } = await svc
    .from('users')
    .select('id')
    .limit(1000)

  if (!users?.length) return NextResponse.json({ processed: 0, promoted: 0 })

  let processed = 0
  let promoted  = 0
  const errors: string[] = []

  for (const { id: userId } of users) {
    try {
      // ── 1. Affiliés directs ──────────────────────────────────────────────────
      const { count: directCount } = await svc
        .from('network_tree')
        .select('user_id', { count: 'exact', head: true })
        .eq('l1_upline', userId)

      // ── 2. Rang actuel (pour calculer affiliés au rang requis + scope TAC) ───
      const { data: rankRow } = await svc
        .from('leader_career_ranks')
        .select('current_rank')
        .eq('user_id', userId)
        .maybeSingle()

      const currentRank = rankRow?.current_rank ?? 0

      // ── 3. Affiliés directs au rang >= currentRank ────────────────────────────
      const { data: directIds } = await svc
        .from('network_tree')
        .select('user_id')
        .eq('l1_upline', userId)

      let directAffiliatesAtRank = 0
      if (directIds?.length) {
        const ids = directIds.map(r => r.user_id)
        const { count } = await svc
          .from('leader_career_ranks')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', ids)
          .gte('current_rank', currentRank)
        directAffiliatesAtRank = count ?? 0
      }

      // ── 4. TAC : membres du scope qui dépensent >= seuil sur 30j ─────────────
      // Le scope et le seuil sont définis par les conditions du rang SUIVANT à atteindre.
      let tacActifsCount = 0
      let tacScopeCount  = 0

      const nextRankCfg = CAREER_RANKS.find(r => r.rank === currentRank + 1)
      if (nextRankCfg && nextRankCfg.conditions !== null) {
        const tac = (nextRankCfg.conditions as {
          tauxActivite: { scopeNiveaux: number; pctRequis: number; seuilDepenseFcfa: number }
        }).tauxActivite

        // Construire le filtre OR sur les N niveaux du scope
        const levelFilters = Array.from(
          { length: tac.scopeNiveaux },
          (_, i) => `l${i + 1}_upline.eq.${userId}`
        ).join(',')

        const { data: scopeRows } = await svc
          .from('network_tree')
          .select('user_id')
          .or(levelFilters)

        if (scopeRows?.length) {
          tacScopeCount = scopeRows.length
          const scopeIds = scopeRows.map(r => r.user_id)

          // Transactions des membres du scope sur les 30 derniers jours
          const { data: txData } = await svc
            .from('transactions')
            .select('buyer_id, amount')
            .in('buyer_id', scopeIds)
            .eq('status', 'completed')
            .gte('created_at', since30d)

          if (txData?.length) {
            // Agréger par acheteur
            const memberTotals = new Map<string, number>()
            for (const tx of txData) {
              memberTotals.set(tx.buyer_id, (memberTotals.get(tx.buyer_id) ?? 0) + (tx.amount ?? 0))
            }
            // Compter ceux qui atteignent le seuil
            for (const total of memberTotals.values()) {
              if (total >= tac.seuilDepenseFcfa) tacActifsCount++
            }
          }
        }
      }

      // ── 5. Marchands directs (L1 affiliés qui sont marchands actifs) ──────────
      let directMerchantsCount = 0
      if (directIds?.length) {
        const ids = directIds.map(r => r.user_id)
        const { count } = await svc
          .from('merchants')
          .select('id', { count: 'exact', head: true })
          .in('user_id', ids)
          .eq('status', 'active')
        directMerchantsCount = count ?? 0
      }

      // ── 6. Marchands réseau (L1-L5, dédupliqués) ─────────────────────────────
      const { data: networkRows } = await svc
        .from('network_tree')
        .select('user_id')
        .or(`l1_upline.eq.${userId},l2_upline.eq.${userId},l3_upline.eq.${userId},l4_upline.eq.${userId},l5_upline.eq.${userId}`)

      let networkMerchantsCount = 0
      if (networkRows?.length) {
        const networkIds = [...new Set(networkRows.map(r => r.user_id))]
        const { count } = await svc
          .from('merchants')
          .select('id', { count: 'exact', head: true })
          .in('user_id', networkIds)
          .eq('status', 'active')
        networkMerchantsCount = count ?? 0
      }

      // ── 7. Mise à jour + promotion éventuelle ─────────────────────────────────
      const result = await updateCareerMetrics(userId, {
        directAffiliatesCount:  directCount  ?? 0,
        directAffiliatesAtRank,
        tacActifsCount,
        tacScopeCount,
        directMerchantsCount,
        networkMerchantsCount,
      })

      if (result.promoted) promoted++
      processed++
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`[CRON/career] processed=${processed} promoted=${promoted} errors=${errors.length}`)
  return NextResponse.json({ processed, promoted, errors: errors.slice(0, 10) })
}
