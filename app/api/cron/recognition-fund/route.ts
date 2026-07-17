/**
 * POST /api/cron/recognition-fund  [RÉVISÉ — migration 081]
 *
 * Cron mensuel — distribution du Fonds de Reconnaissance par sous-pools Fibonacci.
 * À appeler le 1er de chaque mois (après expire-bons).
 *
 * Algorithme :
 *  1. Ventiler les contributions du mois précédent dans les 5 sous-pools (RPC rollup)
 *  2. Pour chaque palier R3..R7 :
 *     a. Récupérer les franchisseurs via RPC get_rank_franchisseurs
 *     b. Lire la balance du sous-pool
 *     c. 0 franchisseur -> skip (la balance s'accumule)
 *     d. 1 franchisseur  -> distribue 50 % de la balance, 50 % reste dans le sous-pool
 *        2+ franchisseurs -> distribue 100 % au prorata du volume communautaire
 *     e. Prélever 10 % de chaque récompense (retour fonds), créditer le net en wallet
 *     f. Déduire le distribué de la balance du sous-pool
 *  3. Réinjecter le total des retours dans les 5 sous-pools selon Fibonacci
 *
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }      from '@/lib/supabase/server'
import { FONDS_POIDS }              from '@/lib/career/engine'

const PALIERS      = [3, 4, 5, 6, 7] as const
const POIDS_SUM    = 50   // somme des poids Fibonacci R3..R7
const RETOUR_RATE  = 0.10 // 10 % de chaque récompense réinjectée dans le fonds

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const svc       = createServiceClient()
  const now       = new Date().toISOString()
  const prevMonth = getPrevMonth(now.slice(0, 7))

  // 1. Rollup : ventiler les contributions du mois précédent dans les sous-pools
  const { error: rollupErr } = await svc
    .rpc('rollup_recognition_fund_subpools', { p_month: prevMonth })

  if (rollupErr) {
    return NextResponse.json(
      { error: `Rollup échoué : ${rollupErr.message}` },
      { status: 500 },
    )
  }

  // 2. Traiter chaque palier
  let totalRetourne  = 0
  let totalDistribue = 0

  const palierResults: Array<{
    rank: number
    balanceAvant: number
    franchisseurs: number
    distribue: number
    retourne: number
    leaders: Array<{ userId: string; gross: number; returned: number; net: number }>
  }> = []

  for (const rank of PALIERS) {
    // 2a. Franchisseurs de ce palier durant prevMonth
    const { data: rawFr } = await svc
      .rpc('get_rank_franchisseurs', { p_rank: rank as number, p_month: prevMonth })

    const franchisseurs = (rawFr as Array<{
      user_id:           string
      career_history_id: string
      volume_brut:       number | string
    }> | null) ?? []

    if (franchisseurs.length === 0) continue

    // 2b. Balance actuelle du sous-pool
    const { data: subpool } = await svc
      .from('recognition_fund_subpool_balances')
      .select('balance_fcfa, total_distributed_fcfa')
      .eq('rank_level', rank)
      .single()

    const balanceAvant = Number(subpool?.balance_fcfa ?? 0)
    if (balanceAvant <= 0) continue

    // 2c-2d. Montant à distribuer selon nombre de franchisseurs
    const count       = franchisseurs.length
    const aDistribuer = count === 1
      ? Math.floor(balanceAvant * 0.5)
      : balanceAvant

    const totalVolume = franchisseurs.reduce(
      (s, f) => s + Number(f.volume_brut), 0
    )

    const palierLeaders: typeof palierResults[0]['leaders'] = []
    let palierRetourne = 0

    for (const f of franchisseurs) {
      const partBrute = totalVolume > 0
        ? Math.floor(aDistribuer * (Number(f.volume_brut) / totalVolume))
        : Math.floor(aDistribuer / count)

      if (partBrute <= 0) continue

      const returned = Math.floor(partBrute * RETOUR_RATE)
      const net      = partBrute - returned
      palierRetourne += returned

      // 2e. Créditer le wallet
      const { data: wallet } = await svc
        .from('wallets')
        .select('id, balance_fcfa, total_earned_fcfa')
        .eq('user_id', f.user_id)
        .single()

      if (wallet) {
        const newBalance = wallet.balance_fcfa + net
        await svc.from('wallets').update({
          balance_fcfa:      newBalance,
          total_earned_fcfa: (wallet.total_earned_fcfa ?? 0) + net,
          updated_at:        now,
        }).eq('id', wallet.id)

        await svc.from('wallet_ledger').insert({
          wallet_id:        wallet.id,
          amount:           net,
          currency_type:    'fcfa',
          transaction_type: 'fonds_reconnaissance',
          reference_id:     f.career_history_id,
          balance_after:    newBalance,
        })
      }

      // Enregistrer l'award (idempotent via career_history_id)
      await svc.from('recognition_fund_awards').upsert({
        user_id:           f.user_id,
        career_history_id: f.career_history_id,
        career_rank:       rank,
        franchise_month:   prevMonth,
        month_year:        prevMonth,
        fibonacci_poids:   FONDS_POIDS[rank],
        community_volume:  Number(f.volume_brut),
        score:             FONDS_POIDS[rank] * Number(f.volume_brut),
        total_scores:      totalVolume,
        subpool_at_dist:   balanceAvant,
        co_franchisseurs:  count,
        gross_award_fcfa:  partBrute,
        returned_fcfa:     returned,
        award_fcfa:        net,
        status:            'paid',
        paid_at:           now,
      }, { onConflict: 'career_history_id' })

      palierLeaders.push({ userId: f.user_id, gross: partBrute, returned, net })
    }

    // 2f. Mettre à jour la balance du sous-pool
    await svc.from('recognition_fund_subpool_balances').update({
      balance_fcfa:           balanceAvant - aDistribuer,
      total_distributed_fcfa: (Number(subpool?.total_distributed_fcfa) || 0) + aDistribuer,
      updated_at:             now,
    }).eq('rank_level', rank)

    totalRetourne  += palierRetourne
    totalDistribue += aDistribuer

    palierResults.push({
      rank,
      balanceAvant,
      franchisseurs: count,
      distribue:     aDistribuer,
      retourne:      palierRetourne,
      leaders:       palierLeaders,
    })
  }

  // 3. Réinjecter les retours dans les 5 sous-pools selon Fibonacci
  if (totalRetourne > 0) {
    const { data: currentSubpools } = await svc
      .from('recognition_fund_subpool_balances')
      .select('rank_level, balance_fcfa, total_added_fcfa')
      .in('rank_level', [3, 4, 5, 6, 7])

    const spMap = new Map(
      (currentSubpools ?? []).map(s => [
        Number(s.rank_level),
        { balance: Number(s.balance_fcfa), added: Number(s.total_added_fcfa) },
      ])
    )

    for (const [rankStr, poids] of Object.entries(FONDS_POIDS)) {
      const rankNum = Number(rankStr)
      const share   = Math.floor(totalRetourne * poids / POIDS_SUM)
      if (share <= 0) continue

      const sp = spMap.get(rankNum)
      if (!sp) continue

      await svc.from('recognition_fund_subpool_balances').update({
        balance_fcfa:     sp.balance + share,
        total_added_fcfa: sp.added + share,
        updated_at:       now,
      }).eq('rank_level', rankNum)
    }
  }

  return NextResponse.json({
    ok:            true,
    prevMonth,
    paliers:       palierResults,
    totalDistribue,
    totalRetourne,
    executedAt:    now,
  })
}

function getPrevMonth(monthYear: string): string {
  const [y, m] = monthYear.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}
