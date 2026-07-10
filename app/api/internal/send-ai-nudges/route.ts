/**
 * GET /api/internal/send-ai-nudges
 *
 * Nudges proactifs WhatsApp pilotés par le profil IA (user_ai_profile,
 * migration 029) — appelée chaque jour par Vercel Cron (voir vercel.json).
 *
 * Logique :
 * 1. On ne cible que les utilisateurs pour qui le moteur a déjà identifié
 *    un trigger psychologique dominant (dominant_trigger != 'unknown') ET
 *    un score actionnable (risque de churn, potentiel de recrutement ou
 *    de dépense) — pas un envoi de masse indifférencié.
 * 2. On respecte le throttle déjà prévu dans le schéma :
 *    - message_fatigue_score élevé (>= 0.7) → on suspend les nudges
 *      (l'utilisateur n'ouvre pas ses messages, insister serait contre-
 *      productif et alimenterait encore la fatigue).
 *    - last_message_sent trop récent (< NUDGE_THROTTLE_DAYS) → on attend.
 * 3. Le contenu de chaque message est choisi selon dominant_trigger, et
 *    décrit uniquement des faits déjà réels (réseau déjà construit, rang
 *    déjà atteint, solde déjà acquis) — jamais une promesse de gain futur
 *    (contrainte explicite du projet).
 * 4. Après envoi, on met à jour last_message_sent / last_message_trigger
 *    pour que le prochain calcul de fatigue (compute-ai-profiles) en tienne
 *    compte.
 *
 * Authentification : même pattern dual que compute-ai-profiles — Bearer
 * CRON_SECRET (Vercel Cron) ou x-internal-secret (legacy/manuel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { RANG_CONFIG } from '@/lib/flamme/engine'
import {
  sendWhatsApp,
  waNudgeBelonging,
  waNudgeStatus,
  waNudgeSecurity,
  waNudgeFomo,
  waNudgeIdentity,
  waNudgeCertainty,
  waNudgeAutonomy,
} from '@/lib/whatsapp/wasender'

const NUDGE_THROTTLE_DAYS = 4
const MAX_FATIGUE_SCORE = 0.7

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get('authorization') ?? ''
  const xInternal   = req.headers.get('x-internal-secret') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  const authorized =
    (!!bearerToken && (bearerToken === process.env.CRON_SECRET || bearerToken === process.env.INTERNAL_API_SECRET)) ||
    (!!xInternal && xInternal === process.env.INTERNAL_API_SECRET)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)

  const svc = createServiceClient()
  const now = new Date()
  const throttleCutoff = new Date(now.getTime() - NUDGE_THROTTLE_DAYS * 86400000).toISOString()

  // ── Sélection : profils avec un trigger identifié, un score actionnable,
  //    pas trop fatigués, pas relancés trop récemment ───────────────────
  const { data: profiles } = await svc
    .from('user_ai_profile')
    .select('user_id, dominant_trigger, churn_score, recruitment_score, spend_potential_score, network_size, direct_recruits, total_gmv_fcfa, message_fatigue_score, last_message_sent')
    .neq('dominant_trigger', 'unknown')
    .lt('message_fatigue_score', MAX_FATIGUE_SCORE)
    .or(`churn_score.gte.0.4,recruitment_score.gte.0.5,spend_potential_score.gte.0.6`)
    .or(`last_message_sent.is.null,last_message_sent.lt.${throttleCutoff}`)
    .order('churn_score', { ascending: false })
    .limit(limit)

  if (!profiles?.length) {
    return NextResponse.json({ message: 'Aucun utilisateur éligible', sent: 0, skipped: 0, errors: 0 })
  }

  const userIds = profiles.map(p => p.user_id)

  const [usersRes, walletsRes, flammesRes] = await Promise.all([
    svc.from('users').select('id, full_name, phone, is_active').in('id', userIds),
    svc.from('wallets').select('user_id, balance_fcfa, total_earned_fcfa').in('user_id', userIds),
    svc.from('user_flammes').select('user_id, rang').in('user_id', userIds),
  ])

  const usersById   = Object.fromEntries((usersRes.data   ?? []).map(u => [u.id, u]))
  const walletsById  = Object.fromEntries((walletsRes.data ?? []).map(w => [w.user_id, w]))
  const flammesById  = Object.fromEntries((flammesRes.data ?? []).map(f => [f.user_id, f]))

  let sent = 0, skipped = 0, errors = 0

  for (const profile of profiles) {
    try {
      const userRow = usersById[profile.user_id] as { full_name: string | null; phone: string | null; is_active: boolean } | undefined
      if (!userRow?.phone || !userRow.is_active) { skipped++; continue }

      const firstName = (userRow.full_name ?? '').split(' ')[0] || 'là'
      const wallet = (walletsById[profile.user_id] as { balance_fcfa: number; total_earned_fcfa: number } | undefined) ?? { balance_fcfa: 0, total_earned_fcfa: 0 }
      const flamme = flammesById[profile.user_id] as { rang: string } | undefined
      const rangConfig = RANG_CONFIG.find(r => r.rang === (flamme?.rang ?? 'étincelle')) ?? RANG_CONFIG[0]

      let message: string
      switch (profile.dominant_trigger) {
        case 'belonging':
          message = waNudgeBelonging({ firstName, networkSize: profile.network_size ?? 0, directRecruits: profile.direct_recruits ?? 0 })
          break
        case 'status':
          message = waNudgeStatus({ firstName, rangLabel: rangConfig.label, rangEmoji: rangConfig.emoji })
          break
        case 'security':
          message = waNudgeSecurity({ firstName, balanceFcfa: wallet.balance_fcfa ?? 0, totalEarnedFcfa: wallet.total_earned_fcfa ?? 0 })
          break
        case 'fomo':
          message = waNudgeFomo({ firstName, directRecruits: profile.direct_recruits ?? 0, networkSize: profile.network_size ?? 0 })
          break
        case 'identity':
          message = waNudgeIdentity({ firstName, directRecruits: profile.direct_recruits ?? 0 })
          break
        case 'certainty':
          message = waNudgeCertainty({ firstName, rangLabel: rangConfig.label, balanceFcfa: wallet.balance_fcfa ?? 0 })
          break
        case 'autonomy':
          message = waNudgeAutonomy({ firstName, balanceFcfa: wallet.balance_fcfa ?? 0 })
          break
        default:
          skipped++
          continue
      }

      await sendWhatsApp(userRow.phone, message)

      await svc.from('user_ai_profile').update({
        last_message_sent: now.toISOString(),
        last_message_trigger: profile.dominant_trigger,
      }).eq('user_id', profile.user_id)

      sent++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ success: true, timestamp: now.toISOString(), sent, skipped, errors })
}
