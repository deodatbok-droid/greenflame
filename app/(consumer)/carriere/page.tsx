/**
 * /carriere — Plan de Carrière GreenFlame
 *
 * Affiche :
 *  - Rang actuel du leader + progression vers le suivant
 *  - Tous les paliers avec Bloc A (récompenses immédiates) + Bloc B (Fonds Reconnaissance)
 *  - Logique de cascade des commissions (N1-N5) et du dividende split
 *  - Historique des franchissements
 *  - Accès Fonds de Reconnaissance pour R3+
 */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect }                          from 'next/navigation'
import BackButton                            from '@/components/ui/BackButton'
import Link                                  from 'next/link'
import CarriereClient                        from './CarriereClient'
import {
  CAREER_RANKS,
  CAREER_REWARDS,
  FONDS_POIDS,
  getCareerRankState,
  checkEligibility,
  getSlotInfo,
  SLOT_BY_RANK,
  SLOT_GATE_PCT,
}                                            from '@/lib/career/engine'
import { GOVERNANCE, DIVIDENDE_SPLIT }       from '@/lib/commission-engine/constants'

export default async function CarrierePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  // État carrière du leader
  const state       = await getCareerRankState(user.id)
  const eligibility = checkEligibility(state)

  const slotInfo    = await getSlotInfo(user.id, state.currentRank)
  const slotsByRank = SLOT_BY_RANK as Record<number, number>

  // Historique des franchissements (6 derniers)
  const { data: historyRows } = await svc
    .from('leader_career_history')
    .select('rank_from, rank_to, rank_name, achieved_at')
    .eq('user_id', user.id)
    .order('achieved_at', { ascending: false })
    .limit(6)

  const history = (historyRows ?? []).map(h => ({
    rankFrom:   h.rank_from,
    rankTo:     h.rank_to,
    rankName:   h.rank_name,
    achievedAt: h.achieved_at,
  }))

  // Assembler les données de chaque rang
  const allRanks = CAREER_RANKS.map(r => ({
    rank:    r.rank,
    name:    r.name,
    slug:    r.slug,
    color:   r.color,
    blocA:   CAREER_REWARDS[r.rank]?.blocA  ?? [],
    blocB:   CAREER_REWARDS[r.rank]?.blocB  ?? null,
    conditions: r.conditions ? {
      affiliesDirects:         r.conditions.affiliesDirectsReqis,
      affiliesAuRangPrecedent: 'affiliesAuRangPrecedent' in r.conditions
        ? (r.conditions.affiliesAuRangPrecedent ?? null)
        : null,
      rangPrecedentName: CAREER_RANKS.find(cr => cr.rank === r.rank - 1)?.name ?? null,
      tauxActivite:      r.conditions.tauxActivite,
      marchandsDirects:  r.conditions.marchandsDirects  ?? 0,
      marchandsReseau:   r.conditions.marchandsReseau   ?? 0,
      marchandsTotal:    (r.conditions.marchandsDirects ?? 0) + (r.conditions.marchandsReseau ?? 0),
    } : null,
  }))

  const networkLevels = [
    { level: 1, label: 'N1 — Membres directs',      rate: GOVERNANCE.NETWORK_LEVELS.L1 },
    { level: 2, label: 'N2 — Cercle secondaire',    rate: GOVERNANCE.NETWORK_LEVELS.L2 },
    { level: 3, label: 'N3 — Cercle tertiaire',     rate: GOVERNANCE.NETWORK_LEVELS.L3 },
    { level: 4, label: 'N4 — Cercle élargi',        rate: GOVERNANCE.NETWORK_LEVELS.L4 },
    { level: 5, label: 'N5 — Cercle stratégique',   rate: GOVERNANCE.NETWORK_LEVELS.L5 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-10 pb-2 flex items-center">
        <BackButton href="/profile" />
      </div>

      <CarriereClient
        currentRank={state.currentRank}
        currentRankName={state.currentRankName}
        rankAchievedAt={state.rankAchievedAt}
        eligibility={eligibility}
        slotInfo={slotInfo}
        slotsByRank={slotsByRank}
        allRanks={allRanks}
        history={history}
        networkLevels={networkLevels}
        fondsPoidsTable={FONDS_POIDS}
        dividendeSplit={{
          cash:        DIVIDENDE_SPLIT.CASH,
          voucher:     DIVIDENDE_SPLIT.VOUCHER,
          recognition: DIVIDENDE_SPLIT.RECOGNITION,
        }}
      />
    </div>
  )
}
