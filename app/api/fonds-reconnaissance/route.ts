/**
 * GET /api/fonds-reconnaissance
 *
 * Tableau de bord du Fonds de Reconnaissance.
 * Accessible à tout leader R3+.
 *
 * Retourne :
 *  - Le pool mensuel en cours (total, contributions)
 *  - L'historique des versements par palier (recognition_fund_awards)
 *  - Le volume communautaire du leader ce mois
 *  - Une estimation de récompense si le leader franchissait son prochain palier maintenant
 */
import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { FONDS_POIDS }         from '@/lib/career/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc       = createServiceClient()
  const monthYear = new Date().toISOString().slice(0, 7)

  // Rang actuel
  const { data: careerRow } = await svc
    .from('leader_career_ranks')
    .select('current_rank')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentRank = careerRow?.current_rank ?? 0

  if (currentRank < 3) {
    return NextResponse.json({
      eligible:    false,
      message:     'Le Fonds de Reconnaissance est accessible à partir du rang Builder (R3).',
      currentRank,
    })
  }

  // Pool mensuel en cours + historique des pools (6 derniers mois pour les sous-pools)
  const { data: pools } = await svc
    .from('recognition_fund_monthly')
    .select('month_year, total_fcfa, contributions_count, status, distributed_at')
    .order('month_year', { ascending: false })
    .limit(7)

  const poolCeMois = pools?.find(p => p.month_year === monthYear) ?? null

  // Historique des versements par palier : agrège recognition_fund_awards par career_rank
  const { data: subpoolRows } = await svc
    .from('recognition_fund_awards')
    .select('career_rank, award_fcfa, month_year')
    .eq('status', 'paid')

  // Construire les sous-pools (R3-R7) : total distribué par palier
  const sousPools = ([3, 4, 5, 6, 7] as const).map(rank => {
    const rows  = (subpoolRows ?? []).filter(r => r.career_rank === rank)
    const total = rows.reduce((s, r) => s + (r.award_fcfa ?? 0), 0)
    const last  = rows.sort((a, b) => b.month_year.localeCompare(a.month_year))[0]
    return {
      rang:            rank,
      totalDistribue:  total,
      dernierMois:     last?.month_year ?? null,
    }
  })

  // Volume communautaire du leader ce mois
  const { data: contribRows } = await svc
    .from('recognition_fund_contributions')
    .select('gross_amount')
    .eq('user_id', user.id)
    .eq('month_year', monthYear)

  const volumeCommunaute = (contribRows ?? []).reduce(
    (s, r) => s + (r.gross_amount ?? 0), 0
  )

  // Estimation pour le prochain palier (franchissement de palier)
  const prochainRang = currentRank < 7 ? currentRank + 1 : null
  let estimationProchain: number | null = null

  if (prochainRang && FONDS_POIDS[prochainRang]) {
    const fondsTotalCeMois = Number(poolCeMois?.total_fcfa ?? 0)

    if (fondsTotalCeMois > 0 && volumeCommunaute > 0) {
      // Scores actuels de tous les leaders éligibles ce mois
      const { data: coFrScores } = await svc
        .rpc('get_recognition_fund_scores', { p_month: monthYear })

      const coFrData = (coFrScores as Array<{
        user_id: string; career_rank: number; volume: number
      }> | null) ?? []

      // Score hypothétique du leader s'il était au rang suivant
      const scorePropre   = FONDS_POIDS[prochainRang] * volumeCommunaute

      // Total des scores actuels (sans le leader à son rang actuel, avec lui au rang suivant)
      const totalScoresHypo = coFrData
        .filter(r => r.career_rank >= 3 && r.career_rank <= 7 && r.user_id !== user.id)
        .reduce((s, r) => s + ((FONDS_POIDS[r.career_rank] ?? 0) * Number(r.volume)), 0)
        + scorePropre

      if (totalScoresHypo > 0) {
        estimationProchain = Math.floor(fondsTotalCeMois * (scorePropre / totalScoresHypo))
      }
    }
  }

  // Historique des récompenses passées du leader (6 entrées max)
  // Colonnes réelles de recognition_fund_awards (migration 080)
  const { data: history } = await svc
    .from('recognition_fund_awards')
    .select('month_year, career_rank, fibonacci_poids, community_volume, award_fcfa, status, paid_at')
    .eq('user_id', user.id)
    .order('month_year', { ascending: false })
    .limit(6)

  return NextResponse.json({
    eligible:     true,
    currentRank,
    monthYear,

    poolCeMois: {
      totalFcfa:          Number(poolCeMois?.total_fcfa ?? 0),
      contributionsCount: poolCeMois?.contributions_count ?? 0,
      status:             poolCeMois?.status ?? 'open',
    },

    sousPools,

    volumeCommunaute,
    prochainRang,
    estimationProchain,

    historique: (history ?? []).map(h => ({
      mois:             h.month_year,
      rang:             h.career_rank,
      poidsFibonacci:   h.fibonacci_poids,
      volumeCommunaute: h.community_volume,
      recompense:       h.award_fcfa,
      statut:           h.status,
      verseLe:          h.paid_at,
    })),
  })
}
