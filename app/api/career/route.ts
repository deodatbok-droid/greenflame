/**
 * GET /api/career — état Plan de Carrière Leaders de l'utilisateur connecté
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCareerRankState, checkEligibility, CAREER_RANKS, CAREER_REWARDS, FONDS_POIDS, getSlotInfo, SLOT_BY_RANK, SLOT_GATE_PCT } from '@/lib/career/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const state       = await getCareerRankState(user.id)
  const eligibility = checkEligibility(state)
  const slotInfo    = await getSlotInfo(user.id, state.currentRank)
  const rankConfig  = CAREER_RANKS.find(r => r.rank === state.currentRank)

  return NextResponse.json({
    state,
    eligibility,
    slotInfo,
    slotsByRank: SLOT_BY_RANK,
    slotGatePct: SLOT_GATE_PCT,
    rankConfig: rankConfig ? {
      rank:  rankConfig.rank,
      name:  rankConfig.name,
      slug:  rankConfig.slug,
      color: rankConfig.color,
    } : null,
    fondsPoidsTable: FONDS_POIDS,
    allRanks: CAREER_RANKS.map(r => ({
      rank:    r.rank,
      name:    r.name,
      slug:    r.slug,
      color:   r.color,
      rewards: CAREER_REWARDS[r.rank] ?? { blocA: [], blocB: null },
      conditions: r.conditions ? {
        affiliesDircts:          r.conditions.affiliesDirectsReqis,
        affiliesAuRangPrecedent: 'affiliesAuRangPrecedent' in r.conditions
          ? (r.conditions.affiliesAuRangPrecedent ?? null)
          : null,
        rangPrecedentName: CAREER_RANKS.find(cr => cr.rank === r.rank - 1)?.name ?? null,
        tauxActivite:   r.conditions.tauxActivite,
        marchandsTotal: (r.conditions.marchandsDirects ?? 0) + (r.conditions.marchandsReseau ?? 0),
      } : null,
    })),
  })
}
