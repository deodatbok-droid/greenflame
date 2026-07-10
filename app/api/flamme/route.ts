/**
 * GET  /api/flamme — état Flamme + Rang de l'utilisateur connecté
 * POST /api/flamme — enregistre un événement FA ou FAU
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getFlammeState,
  recordFlammeEvent,
  getCommunityStats,
  getInactivityStatus,
  RANG_CONFIG,
  type FlammeEventType,
} from '@/lib/flamme/engine'

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const withCommunity = searchParams.get('community') === '1'

  const state = await getFlammeState(user.id)

  // Infos du rang courant
  const rangInfo = RANG_CONFIG.find(c => c.rang === state.rang)!
  const nextRang = RANG_CONFIG.find(c => c.minScore > (RANG_CONFIG.find(r => r.rang === state.rang)?.minScore ?? 0))

  // Historique récent
  const svc = createServiceClient()
  const { data: history } = await svc
    .from('rang_history')
    .select('rang_from, rang_to, reason, score_at_change, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Milestones FAU déjà acquis
  const { data: milestones } = await svc
    .from('fau_milestones_granted')
    .select('life_goal_index, fau_granted, granted_at')
    .eq('user_id', user.id)
    .order('life_goal_index')

  const result: Record<string, unknown> = {
    ...state,
    rangInfo: {
      label: rangInfo.label,
      emoji: rangInfo.emoji,
      minScore: rangInfo.minScore,
      minLifeGoals: rangInfo.minLifeGoals,
    },
    nextRang: nextRang ? {
      rang: nextRang.rang,
      label: nextRang.label,
      minScore: nextRang.minScore,
      minLifeGoals: nextRang.minLifeGoals,
      scoreNeeded: Math.max(0, nextRang.minScore - state.scoreFlamme),
    } : null,
    rangHistory: history ?? [],
    fauMilestones: milestones ?? [],
    inactivityStatus: getInactivityStatus(state),
  }

  if (withCommunity) {
    result.communityStats = await getCommunityStats()
  }

  return NextResponse.json(result)
}

// ─── POST ─────────────────────────────────────────────────────────────────────
/**
 * Body attendu :
 * {
 *   eventType: FlammeEventType,
 *   faDelta?: number,
 *   fauDelta?: number,
 *   referenceId?: string,
 *   referenceType?: string,
 *   lifeGoalIndex?: number,
 *   metadata?: object,
 *   // Pour les appels internes (service key) :
 *   userId?: string,  // uniquement autorisé avec service role
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const {
    eventType,
    faDelta,
    fauDelta,
    referenceId,
    referenceType,
    lifeGoalIndex,
    metadata,
  } = body

  if (!eventType) {
    return NextResponse.json({ error: 'eventType requis' }, { status: 400 })
  }

  // Les appels admin peuvent cibler un autre userId
  const targetUserId = user.id
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const validTypes: FlammeEventType[] = [
    'fa_purchase', 'fa_cashback_monthly', 'fa_network_commission',
    'fa_tontine_cotisation', 'fa_academie_module', 'fau_life_goal',
    'fa_admin_grant', 'fa_admin_deduct', 'fau_admin_grant',
  ]

  if (!validTypes.includes(eventType)) {
    return NextResponse.json({ error: 'eventType invalide' }, { status: 400 })
  }

  // Les types admin sont réservés
  const adminTypes: FlammeEventType[] = ['fa_admin_grant', 'fa_admin_deduct', 'fau_admin_grant']
  if (adminTypes.includes(eventType) && !userRow?.role?.includes('admin')) {
    return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 })
  }

  const result = await recordFlammeEvent({
    userId: targetUserId,
    eventType,
    faDelta: faDelta ?? 0,
    fauDelta: fauDelta ?? 0,
    referenceId,
    referenceType,
    lifeGoalIndex,
    metadata,
  })

  return NextResponse.json(result)
}
