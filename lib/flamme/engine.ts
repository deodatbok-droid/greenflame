import { createServiceClient } from '@/lib/supabase/server'
import { announceInOwnCircle } from '@/lib/messaging/conversations'

export type FlammeEventType =
  | 'fa_purchase' | 'fa_cashback_monthly' | 'fa_network_commission'
  | 'fa_tontine_cotisation' | 'fa_academie_module' | 'fau_life_goal'
  | 'fa_admin_grant' | 'fa_admin_deduct' | 'fau_admin_grant'

export const RANG_CONFIG = [
  { rang: 'étincelle', label: 'Étincelle', emoji: '✨', minScore: 0,   minLifeGoals: 0 },
  { rang: 'flamme',    label: 'Flamme',    emoji: '🔥', minScore: 50,  minLifeGoals: 0 },
  { rang: 'brasier',   label: 'Brasier',   emoji: '🌋', minScore: 150, minLifeGoals: 1 },
  { rang: 'étoile',    label: 'Étoile',    emoji: '⭐', minScore: 350, minLifeGoals: 3 },
  { rang: 'soleil',    label: 'Soleil',    emoji: '☀️', minScore: 700, minLifeGoals: 9 },
] as const

const RANG_ORDER = ['étincelle', 'flamme', 'brasier', 'étoile', 'soleil'] as const
type Rang = typeof RANG_ORDER[number]

export const FAU_MILESTONES = [
  { index: 0, target:  10_000, fau: 10  },
  { index: 1, target:  15_000, fau: 20  },
  { index: 2, target:  20_000, fau: 30  },
  { index: 3, target:  23_500, fau: 40  },
  { index: 4, target:  30_000, fau: 50  },
  { index: 5, target:  40_000, fau: 60  },
  { index: 6, target:  50_000, fau: 70  },
  { index: 7, target:  70_000, fau: 80  },
  { index: 8, target: 258_500, fau: 100 },
] as const

function computeScore(fa: number, fau: number): number {
  return fa + fau * 0.5
}

function computeRang(score: number, lifeGoalsCovered: number, monthlyIncome: number): Rang {
  if (score >= 700 && monthlyIncome >= 258_500) return 'soleil'
  if (score >= 350 && lifeGoalsCovered >= 3)    return 'étoile'
  if (score >= 150 && lifeGoalsCovered >= 1)    return 'brasier'
  if (score >= 50)                               return 'flamme'
  return 'étincelle'
}

export interface FlammeEventInput {
  userId: string
  eventType: FlammeEventType
  faDelta?: number
  fauDelta?: number
  lifeGoalIndex?: number
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, unknown>
}

export interface FlammeState {
  user_id: string
  flammes_activite: number
  flammes_autonomie: number
  score_flamme: number
  scoreFlamme: number
  rang: string
  life_goals_covered: number
  monthly_income_fcfa: number
  last_fa_event_at: string | null
  last_connection_at: string | null
  inactivity_demoted_at: string | null
}

export async function getFlammeState(userId: string): Promise<FlammeState> {
  const svc = createServiceClient()
  const { data } = await svc.from('user_flammes').select('*').eq('user_id', userId).single()

  if (data) {
    const row = data as Record<string, unknown>
    return { ...row, scoreFlamme: row.score_flamme } as FlammeState
  }

  await svc.from('user_flammes').insert({ user_id: userId })
  const { data: created } = await svc.from('user_flammes').select('*').eq('user_id', userId).single()
  const row = (created ?? {}) as Record<string, unknown>
  const fallback = {
    user_id: userId, flammes_activite: 0, flammes_autonomie: 0, score_flamme: 0,
    rang: 'étincelle', life_goals_covered: 0, monthly_income_fcfa: 0,
    last_fa_event_at: null, last_connection_at: null, inactivity_demoted_at: null,
  }
  const merged = Object.keys(row).length ? row : fallback
  return { ...merged, scoreFlamme: (merged.score_flamme as number) ?? 0 } as FlammeState
}

export async function recordFlammeEvent(input: FlammeEventInput): Promise<{
  state: FlammeState
  rangChanged: boolean
  previousRang: string | null
}> {
  const svc = createServiceClient()
  const { userId, eventType, faDelta = 0, fauDelta = 0, lifeGoalIndex, referenceId, referenceType, metadata } = input

  const state = await getFlammeState(userId)
  const newFA    = state.flammes_activite + faDelta
  const newFAU   = state.flammes_autonomie + fauDelta
  const newScore = computeScore(newFA, newFAU)
  const newRang  = computeRang(newScore, state.life_goals_covered, state.monthly_income_fcfa)
  const now      = new Date().toISOString()

  await svc.from('flamme_events').insert({
    user_id: userId,
    event_type: eventType,
    fa_delta: faDelta,
    fau_delta: fauDelta,
    life_goal_index: lifeGoalIndex ?? null,
    reference_id: referenceId ?? null,
    reference_type: referenceType ?? null,
    metadata: metadata ?? {},
  })

  await svc.from('user_flammes').update({
    flammes_activite: newFA,
    flammes_autonomie: newFAU,
    score_flamme: newScore,
    rang: newRang,
    ...(faDelta > 0 ? { last_fa_event_at: now } : {}),
    updated_at: now,
  }).eq('user_id', userId)

  const rangChanged = state.rang !== newRang
  if (rangChanged) {
    const isPromo = RANG_ORDER.indexOf(newRang as Rang) > RANG_ORDER.indexOf(state.rang as Rang)
    await svc.from('rang_history').insert({
      user_id: userId,
      rang_from: state.rang,
      rang_to: newRang,
      reason: isPromo ? 'promotion_score' : 'admin_adjustment',
      score_at_change: newScore,
      life_goals_at_change: state.life_goals_covered,
    })

    // Preuve sociale : annonce factuelle dans le cercle propre de l'utilisateur
    // (jamais une promesse — uniquement la montée déjà actée ci-dessus).
    // Non bloquant : un échec d'annonce ne doit jamais faire échouer l'événement
    // Flamme lui-même (voir announceInOwnCircle).
    if (isPromo) {
      const rangConfig = RANG_CONFIG.find(r => r.rang === newRang)
      const { data: profile } = await svc.from('users').select('full_name').eq('id', userId).maybeSingle()
      const fullName = (profile?.full_name as string | undefined) ?? 'Un membre du cercle'
      if (rangConfig) {
        await announceInOwnCircle(
          svc,
          userId,
          `🔥 *${fullName}* vient de passer au rang ${rangConfig.emoji} *${rangConfig.label}* !`,
        )
      }
    }
  }

  const updatedState = await getFlammeState(userId)
  return { state: updatedState, rangChanged, previousRang: rangChanged ? state.rang : null }
}

export async function updateLifeGoals(userId: string, monthlyIncomeFcfa: number): Promise<void> {
  const svc = createServiceClient()
  const coveredCount = FAU_MILESTONES.filter(m => monthlyIncomeFcfa >= m.target).length

  const { data: granted } = await svc
    .from('fau_milestones_granted')
    .select('life_goal_index')
    .eq('user_id', userId)

  const grantedSet = new Set((granted ?? []).map((g: { life_goal_index: number }) => g.life_goal_index))
  let totalNewFAU = 0

  for (const milestone of FAU_MILESTONES) {
    if (monthlyIncomeFcfa >= milestone.target && !grantedSet.has(milestone.index)) {
      const { error } = await svc.from('fau_milestones_granted').insert({
        user_id: userId,
        life_goal_index: milestone.index,
        fau_granted: milestone.fau,
      })
      if (!error) totalNewFAU += milestone.fau
    }
  }

  if (totalNewFAU === 0) {
    await svc.from('user_flammes').update({
      life_goals_covered: coveredCount,
      monthly_income_fcfa: monthlyIncomeFcfa,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return
  }

  await recordFlammeEvent({
    userId,
    eventType: 'fau_life_goal',
    fauDelta: totalNewFAU,
    metadata: { monthly_income_fcfa: monthlyIncomeFcfa, covered_count: coveredCount },
  })

  await svc.from('user_flammes').update({
    life_goals_covered: coveredCount,
    monthly_income_fcfa: monthlyIncomeFcfa,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
}

export async function recordConnection(userId: string): Promise<void> {
  const svc = createServiceClient()
  await svc.from('user_flammes').upsert({
    user_id: userId,
    last_connection_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function applyInactivityCheck(userId: string): Promise<void> {
  const svc = createServiceClient()
  const state = await getFlammeState(userId)

  const lastActive = state.last_fa_event_at || state.last_connection_at
  if (!lastActive) return

  const daysSince = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince < 60) return

  const currentIndex = RANG_ORDER.indexOf(state.rang as Rang)
  if (currentIndex <= 0) return

  const newRang = RANG_ORDER[currentIndex - 1]
  const now     = new Date().toISOString()

  await svc.from('user_flammes').update({
    rang: newRang,
    inactivity_demoted_at: now,
    updated_at: now,
  }).eq('user_id', userId)

  await svc.from('rang_history').insert({
    user_id: userId,
    rang_from: state.rang,
    rang_to: newRang,
    reason: 'inactivity_demotion',
    score_at_change: state.score_flamme,
    life_goals_at_change: state.life_goals_covered,
  })
}

export interface InactivityStatus {
  daysSinceActive: number | null
  daysUntilDemotion: number | null
  isAtRisk: boolean
  inWarningWindow: boolean
}

/**
 * Calcule où se trouve l'utilisateur par rapport au cliff d'inactivité de 60
 * jours (voir applyInactivityCheck / migration 053 pg_cron). Fonction pure,
 * pas d'appel réseau — appelée à partir d'un FlammeState déjà chargé, pour
 * pouvoir l'utiliser à la fois côté UI (compte à rebours) et côté cron
 * d'alerte WhatsApp sans dupliquer le calcul.
 *
 * isAtRisk = false si l'utilisateur est déjà au rang le plus bas (rien à
 * perdre) ou n'a encore aucune activité enregistrée — pas de risque réel,
 * donc pas d'alerte à afficher/envoyer.
 *
 * inWarningWindow = fenêtre des 15 derniers jours avant le cliff (45-59
 * jours d'inactivité) — fenêtre volontairement courte pour rester un signal
 * d'alerte ponctuel, pas une pression permanente.
 */
export function getInactivityStatus(state: Pick<FlammeState, 'last_fa_event_at' | 'last_connection_at' | 'rang'>): InactivityStatus {
  const lastActive = state.last_fa_event_at || state.last_connection_at
  const currentIndex = RANG_ORDER.indexOf(state.rang as Rang)

  if (!lastActive || currentIndex <= 0) {
    return { daysSinceActive: null, daysUntilDemotion: null, isAtRisk: false, inWarningWindow: false }
  }

  const daysSinceActive = Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24))
  const daysUntilDemotion = Math.max(0, 60 - daysSinceActive)
  const inWarningWindow = daysSinceActive >= 45 && daysSinceActive < 60

  return { daysSinceActive, daysUntilDemotion, isAtRisk: true, inWarningWindow }
}

export async function getCommunityStats() {
  const svc = createServiceClient()
  const { data } = await svc.from('flamme_community_stats').select('*').single()
  return data ?? {
    count_etincelle: 0, count_flamme: 0, count_brasier: 0,
    count_etoile: 0, count_soleil: 0, total_members: 0,
  }
}
