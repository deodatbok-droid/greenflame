/**
 * GreenFlame — Moteur Plan de Carrière Leaders
 *
 * 8 rangs (R0 Starter → R8 Elder), triple verrou simultané :
 *   Clé 1 : Structure réseau (5 affiliés directs au rang R-1)
 *   Clé 2 : TAC — X% des affiliés du scope dépensent ≥ seuil FCFA/mois
 *   Clé 3 : Marchands actifs — Config C (directs + cascade)
 */
import { createServiceClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────
// Configuration des rangs
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Poids Fibonacci pour le Fonds de Reconnaissance (R3 → R7)
// Part = Fonds × (poids × volume_communauté / Σ scores)
// ─────────────────────────────────────────────────────────────
export const FONDS_POIDS: Record<number, number> = {
  3: 3,
  4: 5,
  5: 8,
  6: 13,
  7: 21,
}

// ─────────────────────────────────────────────────────────────
// Récompenses par rang — deux blocs :
//   Bloc A : débloquées garanties à chaque changement de palier (non-physiques)
//   Bloc B : récompenses physiques/cash financées par le Fonds de Reconnaissance
//            (null pour les rangs sans Bloc B, c.-à-d. R0-R2)
// ─────────────────────────────────────────────────────────────
export interface CareerRewardEntry {
  blocA: string[]
  blocB: { poids: number; items: string[] } | null
}

export const CAREER_REWARDS: Record<number, CareerRewardEntry> = {
  0: {
    blocA: [
      'Portefeuille digital GreenFlame',
      'Dashboard basique',
      'Accès Académie — module découverte',
    ],
    blocB: null,
  },
  1: {
    blocA: [
      'Badge Étincelle (numérique)',
      'SMS personnalisé GreenFlame',
      '500 GFP bonus',
      'Cashback personnel actif',
    ],
    blocB: null,
  },
  2: {
    blocA: [
      'Badge numérique Créateur',
      'Formation Créateur — GF Academy (certification obligatoire)',
      'Kit démarrage physique (cartes de visite, affiche GreenFlame)',
      'Certificat digital signé GreenFlame',
    ],
    blocB: null,
  },
  3: {
    blocA: [
      'Formation Builder — GF Academy',
      'Badge Builder dans l\'application',
      'Profil public sur la plateforme GreenFlame',
    ],
    blocB: {
      poids: FONDS_POIDS[3],  // 3
      items: ['Pocket wifi (20 000 – 25 000 FCFA) + forfait Internet illimité 1 mois'],
    },
  },
  4: {
    blocA: [
      'Formation Leader Flamme — GF Academy',
      'Reconnaissance publique — featured app & site communauté',
      'Badge Leader Flamme (numérique)',
    ],
    blocB: {
      poids: FONDS_POIDS[4],  // 5
      items: ['Smartphone (valeur ~70 000 FCFA)'],
    },
  },
  5: {
    blocA: [
      'Badge / pins Leader Brasier (identification physique)',
      'Formation Leader Brasier — GF Academy',
    ],
    blocB: {
      poids: FONDS_POIDS[5],  // 8
      items: ['100 000 FCFA en espèces', 'Tablette + abonnement Internet illimité 1 mois'],
    },
  },
  6: {
    blocA: [
      'Trophée / distinction Ambassadeur',
      'Formation Ambassadeur — GF Academy',
      'Accès Conférence Nationale GreenFlame + prise de parole',
    ],
    blocB: {
      poids: FONDS_POIDS[6],  // 13
      items: ['150 000 FCFA en espèces', 'Smart TV + Réfrigérateur (valeur ~350 000 FCFA)'],
    },
  },
  7: {
    blocA: [
      'Formation exclusive Kingmaker — GF Academy',
      'Citation permanente — plateforme GreenFlame & siège',
      'Distinction officielle à un événement GreenFlame',
      'UCP éligible — Ubuntu Capital Plan',
      'Accès cercle Fondateurs — sessions stratégiques',
    ],
    blocB: {
      poids: FONDS_POIDS[7],  // 21
      items: ['Moto OU ordinateur + 200 000 FCFA (choix du leader)'],
    },
  },
  8: {
    blocA: [
      'Accès actionnariat préférentiel — UCP prioritaire',
      'Distinction continentale — Cérémonie Convention annuelle',
      'Keynote speaker officiel GreenFlame',
      'Reconnaissance pan-africaine',
    ],
    // Bloc B Elder : délibération Comité, hors formule Fibonacci
    blocB: {
      poids: 0,
      items: ['Espèces — montant exceptionnel (défini par Comité GreenFlame)'],
    },
  },
}

export const CAREER_RANKS = [
  {
    rank: 0,
    name: 'Starter',
    slug: 'starter',
    color: '#7A7875',
    conditions: null,  // aucune condition — rang d'entrée
  },
  {
    rank: 1,
    name: 'Étincelle',
    slug: 'etincelle',
    color: '#D9A43A',
    conditions: {
      affiliesDirectsReqis: 1,
      tauxActivite: { scopeNiveaux: 1, pctRequis: 0.10, seuilDepenseFcfa: 5_000 },
      marchandsDirects: 0,
      marchandsReseau: 0,
    },
  },
  {
    rank: 2,
    name: 'Créateur',
    slug: 'createur',
    color: '#E87040',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 1, pctRequis: 0.10, seuilDepenseFcfa: 10_000 },
      marchandsDirects: 1,
      marchandsReseau: 0,
    },
  },
  {
    rank: 3,
    name: 'Builder',
    slug: 'builder',
    color: '#5BAD24',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 2, pctRequis: 0.10, seuilDepenseFcfa: 20_000 },
      marchandsDirects: 2,
      marchandsReseau: 0,
    },
  },
  {
    rank: 4,
    name: 'Leader Flamme',
    slug: 'leader-flamme',
    color: '#4A9DEA',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 2, pctRequis: 0.10, seuilDepenseFcfa: 30_000 },
      marchandsDirects: 2,
      marchandsReseau: 6,
    },
  },
  {
    rank: 5,
    name: 'Leader Brasier',
    slug: 'leader-brasier',
    color: '#8270D4',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 3, pctRequis: 0.07, seuilDepenseFcfa: 50_000 },
      marchandsDirects: 3,
      marchandsReseau: 17,
    },
  },
  {
    rank: 6,
    name: 'Ambassadeur',
    slug: 'ambassadeur',
    color: '#20B08A',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 3, pctRequis: 0.03, seuilDepenseFcfa: 60_000 },
      marchandsDirects: 3,
      marchandsReseau: 47,
    },
  },
  {
    rank: 7,
    name: 'Kingmaker',
    slug: 'kingmaker',
    color: '#D94545',
    conditions: {
      affiliesDirectsReqis: 5,
      affiliesAuRangPrecedent: 5,
      tauxActivite: { scopeNiveaux: 5, pctRequis: 0.01, seuilDepenseFcfa: 100_000 },
      marchandsDirects: 5,
      marchandsReseau: 145,
    },
  },
  {
    rank: 8,
    name: 'Elder',
    slug: 'elder',
    color: '#C49B1A',
    conditions: null,  // conditions d'exception — délibération Comité GreenFlame
  },
] as const

export type CareerRankSlug = typeof CAREER_RANKS[number]['slug']

// ─────────────────────────────────────────────────────────────
// Forced Matrix — mapping rang → max_direct_slots
// Progression : 5→5→5→6→6→8→8→10→10 (R0 à R8)
// Condition de déblocage : SLOT_GATE_PCT des slots existants doivent être "vivants"
// (actif ce mois + ≥2 recrues personnelles)
// ─────────────────────────────────────────────────────────────

export const SLOT_BY_RANK: Record<number, number> = {
  0: 5,   // Starter
  1: 5,   // Étincelle
  2: 5,   // Créateur
  3: 6,   // Builder
  4: 6,   // Leader Flamme
  5: 8,   // Leader Brasier
  6: 8,   // Ambassadeur
  7: 10,  // Kingmaker
  8: 10,  // Elder
}

/** Pourcentage des slots directs devant être "vivants" avant de débloquer le tier suivant */
export const SLOT_GATE_PCT = 0.60

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CareerRankState {
  userId: string
  currentRank: number
  currentRankName: string
  rankAchievedAt: string | null
  // Progression vers le rang suivant (0-100)
  verrou_structure_pct: number
  verrou_volume_pct: number
  verrou_marchands_pct: number
  // Données brutes
  directAffiliatesCount: number
  directAffiliatesAtRank: number
  tacActifsCount: number   // membres du scope qui dépensent >= seuil ce mois
  tacScopeCount: number    // total membres dans le scope
  directMerchantsCount: number
  networkMerchantsCount: number
  // Histoire
  history: CareerRankHistoryEntry[]
}

export interface CareerRankHistoryEntry {
  rankFrom: number
  rankTo: number
  rankName: string
  achievedAt: string
}

export interface TacVerrouDetails {
  pctRequis: number
  seuilFcfa: number
  scopeCount: number
}

export interface CareerEligibility {
  eligible: boolean
  nextRank: number | null
  nextRankName: string | null
  verrous: {
    structure: { valid: boolean; current: number; required: number; pct: number }
    volume:    { valid: boolean; current: number; required: number; pct: number; tac: TacVerrouDetails }
    marchands: { valid: boolean; current: number; required: number; pct: number }
  }
}

// ─────────────────────────────────────────────────────────────
// Lecture de l'état
// ─────────────────────────────────────────────────────────────

export async function getCareerRankState(userId: string): Promise<CareerRankState> {
  const svc = createServiceClient()

  // Initialiser si absent
  const { data: existing } = await svc
    .from('leader_career_ranks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    await svc.from('leader_career_ranks').insert({ user_id: userId })
  }

  const { data: row } = await svc
    .from('leader_career_ranks')
    .select('*')
    .eq('user_id', userId)
    .single()

  const { data: history } = await svc
    .from('leader_career_history')
    .select('rank_from, rank_to, rank_name, achieved_at')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false })
    .limit(20)

  const rankConfig = CAREER_RANKS.find(r => r.rank === (row?.current_rank ?? 0))

  return {
    userId,
    currentRank:           row?.current_rank            ?? 0,
    currentRankName:       rankConfig?.name             ?? 'Starter',
    rankAchievedAt:        row?.rank_achieved_at        ?? null,
    verrou_structure_pct:  row?.verrou_structure_pct    ?? 0,
    verrou_volume_pct:     row?.verrou_volume_pct       ?? 0,
    verrou_marchands_pct:  row?.verrou_marchands_pct    ?? 0,
    directAffiliatesCount: row?.direct_affiliates_count ?? 0,
    directAffiliatesAtRank:row?.direct_affiliates_at_rank ?? 0,
    tacActifsCount:        row?.tac_actifs_count        ?? 0,
    tacScopeCount:         row?.tac_scope_count         ?? 0,
    directMerchantsCount:  row?.direct_merchants_count  ?? 0,
    networkMerchantsCount: row?.network_merchants_count ?? 0,
    history: (history ?? []).map(h => ({
      rankFrom:    h.rank_from,
      rankTo:      h.rank_to,
      rankName:    h.rank_name,
      achievedAt:  h.achieved_at,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// Vérification d'éligibilité (pure — sans DB write)
// ─────────────────────────────────────────────────────────────

const NULL_TAC: TacVerrouDetails = { pctRequis: 0, seuilFcfa: 0, scopeCount: 0 }

export function checkEligibility(state: CareerRankState): CareerEligibility {
  const nextRankIdx = state.currentRank + 1
  if (nextRankIdx > 8) {
    return { eligible: false, nextRank: null, nextRankName: null, verrous: {
      structure: { valid: true,  current: 0, required: 0, pct: 100 },
      volume:    { valid: true,  current: 0, required: 0, pct: 100, tac: NULL_TAC },
      marchands: { valid: true,  current: 0, required: 0, pct: 100 },
    }}
  }

  const nextConfig = CAREER_RANKS.find(r => r.rank === nextRankIdx)
  if (!nextConfig || nextConfig.conditions === null) {
    // Elder — conditions d'exception
    return { eligible: false, nextRank: 8, nextRankName: 'Elder', verrous: {
      structure: { valid: false, current: 0, required: 0, pct: 0, },
      volume:    { valid: false, current: 0, required: 0, pct: 0, tac: NULL_TAC },
      marchands: { valid: false, current: 0, required: 0, pct: 0 },
    }}
  }

  const cond = nextConfig.conditions as {
    affiliesDirectsReqis: number
    affiliesAuRangPrecedent?: number
    tauxActivite: { scopeNiveaux: number; pctRequis: number; seuilDepenseFcfa: number }
    marchandsDirects: number
    marchandsReseau: number
  }

  // Verrou 1 : Structure
  const reqStruct   = cond.affiliesAuRangPrecedent ?? cond.affiliesDirectsReqis
  const curStruct   = cond.affiliesAuRangPrecedent != null
    ? state.directAffiliatesAtRank
    : state.directAffiliatesCount
  const pctStruct   = Math.min(100, reqStruct > 0 ? Math.round((curStruct / reqStruct) * 100) : 100)
  const validStruct = curStruct >= reqStruct

  // Verrou 2 : TAC (Taux d'Activité Communautaire)
  // Condition : tacActifsCount / tacScopeCount >= pctRequis
  const tac       = cond.tauxActivite
  const tacActifs = state.tacActifsCount
  const tacScope  = state.tacScopeCount
  // Minimum de personnes à atteindre (arrondi au supérieur, min 1)
  const tacRequis = Math.max(1, Math.ceil(tacScope * tac.pctRequis))
  const pctVol    = Math.min(100, tacRequis > 0 ? Math.round((tacActifs / tacRequis) * 100) : 100)
  const validVol  = tacScope > 0 && (tacActifs / tacScope) >= tac.pctRequis

  const tacDetails: TacVerrouDetails = {
    pctRequis: tac.pctRequis,
    seuilFcfa: tac.seuilDepenseFcfa,
    scopeCount: tacScope,
  }

  // Verrou 3 : Marchands (directs + réseau)
  const reqMrc    = (cond.marchandsDirects ?? 0) + (cond.marchandsReseau ?? 0)
  const curMrc    = state.directMerchantsCount + state.networkMerchantsCount
  const pctMrc    = Math.min(100, reqMrc > 0 ? Math.round((curMrc / reqMrc) * 100) : 100)
  const validMrc  = state.directMerchantsCount >= (cond.marchandsDirects ?? 0)
                 && state.networkMerchantsCount  >= (cond.marchandsReseau ?? 0)

  return {
    eligible:      validStruct && validVol && validMrc,
    nextRank:      nextRankIdx,
    nextRankName:  nextConfig.name,
    verrous: {
      structure: { valid: validStruct, current: curStruct,  required: reqStruct,  pct: pctStruct },
      volume:    { valid: validVol,    current: tacActifs,   required: tacRequis,  pct: pctVol, tac: tacDetails },
      marchands: { valid: validMrc,    current: curMrc,      required: reqMrc,     pct: pctMrc    },
    },
  }
}

// ─────────────────────────────────────────────────────────────
// Mise à jour des métriques brutes (appelée par les crons / événements)
// ─────────────────────────────────────────────────────────────

export async function updateCareerMetrics(userId: string, metrics: {
  directAffiliatesCount?:  number
  directAffiliatesAtRank?: number
  tacActifsCount?:         number
  tacScopeCount?:          number
  directMerchantsCount?:   number
  networkMerchantsCount?:  number
}): Promise<{ promoted: boolean; newRank: number }> {
  const svc  = createServiceClient()
  const now  = new Date().toISOString()
  const state = await getCareerRankState(userId)

  const merged: CareerRankState = {
    ...state,
    ...(metrics.directAffiliatesCount  != null ? { directAffiliatesCount:  metrics.directAffiliatesCount  } : {}),
    ...(metrics.directAffiliatesAtRank != null ? { directAffiliatesAtRank: metrics.directAffiliatesAtRank } : {}),
    ...(metrics.tacActifsCount         != null ? { tacActifsCount:         metrics.tacActifsCount         } : {}),
    ...(metrics.tacScopeCount          != null ? { tacScopeCount:          metrics.tacScopeCount          } : {}),
    ...(metrics.directMerchantsCount   != null ? { directMerchantsCount:   metrics.directMerchantsCount   } : {}),
    ...(metrics.networkMerchantsCount  != null ? { networkMerchantsCount:  metrics.networkMerchantsCount  } : {}),
  }

  const eligibility = checkEligibility(merged)

  const updatePayload: Record<string, unknown> = {
    direct_affiliates_count:   merged.directAffiliatesCount,
    direct_affiliates_at_rank: merged.directAffiliatesAtRank,
    tac_actifs_count:          merged.tacActifsCount,
    tac_scope_count:           merged.tacScopeCount,
    direct_merchants_count:    merged.directMerchantsCount,
    network_merchants_count:   merged.networkMerchantsCount,
    verrou_structure_pct:      eligibility.verrous.structure.pct,
    verrou_volume_pct:         eligibility.verrous.volume.pct,
    verrou_marchands_pct:      eligibility.verrous.marchands.pct,
    last_evaluated_at:         now,
    updated_at:                now,
  }

  let promoted = false

  if (eligibility.eligible && eligibility.nextRank != null) {
    const newRank    = eligibility.nextRank
    const newRankCfg = CAREER_RANKS.find(r => r.rank === newRank)!

    updatePayload.current_rank      = newRank
    updatePayload.rank_achieved_at  = now

    await svc.from('leader_career_history').insert({
      user_id:    userId,
      rank_from:  state.currentRank,
      rank_to:    newRank,
      rank_name:  newRankCfg.name,
      achieved_at: now,
      snapshot: {
        directAffiliatesCount:  merged.directAffiliatesCount,
        directAffiliatesAtRank: merged.directAffiliatesAtRank,
        tacActifsCount:         merged.tacActifsCount,
        tacScopeCount:          merged.tacScopeCount,
        directMerchantsCount:   merged.directMerchantsCount,
        networkMerchantsCount:  merged.networkMerchantsCount,
      },
    })

    promoted = true

    // Forced Matrix : mise a jour max_direct_slots si rang change de tier
    const newSlots = SLOT_BY_RANK[newRank]          ?? 5
    const oldSlots = SLOT_BY_RANK[state.currentRank] ?? 5

    if (newSlots > oldSlots) {
      const gateOk = await checkSlotGate(userId, oldSlots, svc)
      if (gateOk) {
        await svc.from('users').update({ max_direct_slots: newSlots }).eq('id', userId)
      }
    }
  }

  await svc.from('leader_career_ranks').upsert(
    { user_id: userId, ...updatePayload },
    { onConflict: 'user_id' }
  )

  const finalState = await getCareerRankState(userId)
  return { promoted, newRank: finalState.currentRank }
}

// ─────────────────────────────────────────────────────────────
// Slot Gate — vérifie si SLOT_GATE_PCT des slots directs sont "vivants"
// (actif ce mois + ≥2 recrues personnelles)
// ─────────────────────────────────────────────────────────────

async function checkSlotGate(
  userId:      string,
  currentSlots: number,
  svc:         ReturnType<typeof createServiceClient>,
): Promise<boolean> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Récupérer les affiliés directs
  const { data: directs } = await svc
    .from('users')
    .select('id, last_active_at')
    .eq('upline_id', userId)

  if (!directs?.length) return false

  const directIds = directs.map(d => d.id)

  // Compter les recrues personnelles de chaque affilié direct (en batch)
  const { data: recruitRows } = await svc
    .from('users')
    .select('enrolled_by_id')
    .in('enrolled_by_id', directIds)

  const recruitCounts: Record<string, number> = {}
  for (const row of recruitRows ?? []) {
    if (row.enrolled_by_id) {
      recruitCounts[row.enrolled_by_id] = (recruitCounts[row.enrolled_by_id] ?? 0) + 1
    }
  }

  // Compter les slots "vivants" : actif + ≥2 recrues
  let alive = 0
  for (const d of directs) {
    const isActive  = !!d.last_active_at && d.last_active_at >= since30d
    const hasRecruits = (recruitCounts[d.id] ?? 0) >= 2
    if (isActive && hasRecruits) alive++
  }

  const required = Math.ceil(currentSlots * SLOT_GATE_PCT)
  return alive >= required
}

// ─────────────────────────────────────────────────────────────
// Slots directs — état et gate pour le Forced Matrix
// ─────────────────────────────────────────────────────────────

export interface SlotInfo {
  currentMax:   number         // max_direct_slots actuel dans users
  aliveCount:   number         // affiliés directs vivants (actif 30j + ≥2 recrues)
  gateRequired: number         // ceil(currentMax × SLOT_GATE_PCT)
  gateOk:       boolean
  nextRankMax:  number | null  // slots du rang suivant si supérieur, sinon null
}

export async function getSlotInfo(userId: string, currentRank: number): Promise<SlotInfo> {
  const svc      = createServiceClient()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: userRow } = await svc
    .from('users')
    .select('max_direct_slots')
    .eq('id', userId)
    .single()

  const currentMax   = userRow?.max_direct_slots ?? 5
  const gateRequired = Math.ceil(currentMax * SLOT_GATE_PCT)

  const { data: directs } = await svc
    .from('users')
    .select('id, last_active_at')
    .eq('upline_id', userId)

  let aliveCount = 0
  if (directs?.length) {
    const ids = directs.map(d => d.id)
    const { data: recruits } = await svc
      .from('users')
      .select('enrolled_by_id')
      .in('enrolled_by_id', ids)

    const counts: Record<string, number> = {}
    for (const r of recruits ?? []) {
      if (r.enrolled_by_id) counts[r.enrolled_by_id] = (counts[r.enrolled_by_id] ?? 0) + 1
    }
    for (const d of directs) {
      const isActive = !!d.last_active_at && d.last_active_at >= since30d
      if (isActive && (counts[d.id] ?? 0) >= 2) aliveCount++
    }
  }

  const gateOk     = aliveCount >= gateRequired
  const targetMax  = SLOT_BY_RANK[currentRank + 1] ?? currentMax
  const nextRankMax = targetMax > currentMax ? targetMax : null

  return { currentMax, aliveCount, gateRequired, gateOk, nextRankMax }
}

// ─────────────────────────────────────────────────────────────
// Réévaluation manuelle du max_direct_slots
// Appelée par le cron ou l'admin pour débloquer des slots après coup
// ─────────────────────────────────────────────────────────────

export async function reevaluateMaxSlots(userId: string): Promise<{ updated: boolean; newSlots: number }> {
  const svc = createServiceClient()

  const { data: rankRow } = await svc
    .from('leader_career_ranks')
    .select('current_rank')
    .eq('user_id', userId)
    .maybeSingle()

  const currentRank = rankRow?.current_rank ?? 0
  const targetSlots = SLOT_BY_RANK[currentRank] ?? 5

  const { data: userRow } = await svc
    .from('users')
    .select('max_direct_slots')
    .eq('id', userId)
    .single()

  const currentSlots = userRow?.max_direct_slots ?? 5

  if (targetSlots <= currentSlots) return { updated: false, newSlots: currentSlots }

  const gateOk = await checkSlotGate(userId, currentSlots, svc)
  if (!gateOk) return { updated: false, newSlots: currentSlots }

  await svc.from('users').update({ max_direct_slots: targetSlots }).eq('id', userId)
  return { updated: true, newSlots: targetSlots }
}
