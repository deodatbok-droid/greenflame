/**
 * GET /api/internal/compute-ai-profiles
 *
 * Scoring quotidien IA — Phase 1 (heuristiques)
 * Appelée chaque nuit par Vercel Cron (voir vercel.json).
 *
 * Pour chaque utilisateur, calcule :
 * - dominant_trigger        : quel levier psychologique dominant
 * - churn_score             : risque de désengagement
 * - recruitment_score       : probabilité de recruter dans les 30j
 * - spend_potential_score   : volume de dépenses non capturées
 * - métriques comportementales agrégées
 *
 * Authentification : Vercel Cron envoie "Authorization: Bearer <CRON_SECRET>"
 * (même mécanisme que /api/cron/daily-digest). On accepte aussi l'ancien
 * header x-internal-secret pour compatibilité avec les appels manuels.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // Auth interne — Bearer CRON_SECRET (Vercel Cron) ou x-internal-secret (legacy/manuel)
  const authHeader  = req.headers.get('authorization') ?? ''
  const xInternal   = req.headers.get('x-internal-secret') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  const authorized =
    (!!bearerToken && (bearerToken === process.env.CRON_SECRET || bearerToken === process.env.INTERNAL_API_SECRET)) ||
    (!!xInternal && xInternal === process.env.INTERNAL_API_SECRET)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()
  const startReport: { processed: number; errors: number; duration_ms: number } = {
    processed: 0, errors: 0, duration_ms: 0,
  }
  const t0 = Date.now()

  // ── Charger tous les utilisateurs avec leurs données ─────────────
  const { data: users } = await svc
    .from('users')
    .select('id, created_at, last_active_at')
    .eq('is_active', true)

  if (!users?.length) {
    return NextResponse.json({ message: 'No active users', ...startReport })
  }

  const userIds = users.map(u => u.id)

  // ── Charger les métriques en batch ────────────────────────────────
  const [txRes, networkRes, eventsRes, notifRes] = await Promise.all([
    // Transactions par utilisateur
    svc.from('transactions')
      .select('buyer_id, amount_fcfa, payment_method, created_at')
      .in('buyer_id', userIds)
      .eq('status', 'completed')
      .gte('created_at', new Date(now.getTime() - 90 * 86400000).toISOString()),

    // Réseau L1 par utilisateur
    svc.from('network_tree')
      .select('user_id, l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
      .in('user_id', userIds),

    // Événements comportementaux des 30 derniers jours
    svc.from('user_events')
      .select('user_id, event_type, metadata, created_at')
      .in('user_id', userIds)
      .gte('created_at', new Date(now.getTime() - 30 * 86400000).toISOString()),

    // Filleuls directs recrutés
    svc.from('network_tree')
      .select('user_id, l1_upline')
      .in('l1_upline', userIds),
  ])

  const txList      = txRes.data      ?? []
  const networkList = networkRes.data ?? []
  const eventsList  = eventsRes.data  ?? []
  const recruits    = notifRes.data   ?? []

  // ── Indexation pour accès O(1) ────────────────────────────────────
  const txByUser     = groupBy(txList, 'buyer_id')
  const networkByUser= groupBy(networkList, 'user_id')
  const eventsByUser = groupBy(eventsList, 'user_id')
  const recruitsByUpline = groupBy(recruits, 'l1_upline')

  // ── Traiter chaque utilisateur ────────────────────────────────────
  const updates: Record<string, unknown>[] = []

  for (const user of users) {
    try {
      const uid   = user.id
      const txs   = txByUser[uid]   ?? []
      const net   = networkByUser[uid]?.[0]
      const evts  = eventsByUser[uid] ?? []
      const myRecruits = recruitsByUpline[uid] ?? []

      // ── Métriques de base ───────────────────────────────────────
      const totalTx   = txs.length
      const totalGmv  = txs.reduce((s, t) => s + (t.amount_fcfa ?? 0), 0)
      const avgTx     = totalTx > 0 ? Math.floor(totalGmv / totalTx) : 0

      const lastTx    = txs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      const daysSinceTx = lastTx
        ? Math.floor((now.getTime() - new Date(lastTx.created_at).getTime()) / 86400000)
        : 999

      // Taille réseau (nombre de niveaux remplis)
      const networkSize = [net?.l1_upline, net?.l2_upline, net?.l3_upline, net?.l4_upline, net?.l5_upline]
        .filter(Boolean).length
      const directRecruits = myRecruits.length

      // Paiement préféré
      const paymentCounts: Record<string, number> = {}
      txs.forEach(t => {
        if (t.payment_method) paymentCounts[t.payment_method] = (paymentCounts[t.payment_method] ?? 0) + 1
      })
      const preferredPayment = Object.entries(paymentCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      // Sessions 30 derniers jours
      const sessions30d = new Set(
        evts.filter(e => e.event_type === 'session_started').map(e => e.created_at.slice(0, 10))
      ).size

      // Notifications
      const notifSent   = evts.filter(e => e.event_type === 'notification_sent').length
      const notifOpened = evts.filter(e => e.event_type === 'notification_opened').length
      const openRate    = notifSent > 0 ? notifOpened / notifSent : null

      // ── CHURN SCORE ─────────────────────────────────────────────
      // Plus le score est élevé, plus l'utilisateur risque de partir
      let churnScore = 0

      if (daysSinceTx >= 30)      churnScore += 0.40
      else if (daysSinceTx >= 21) churnScore += 0.30
      else if (daysSinceTx >= 14) churnScore += 0.20
      else if (daysSinceTx >= 7)  churnScore += 0.10

      if (sessions30d === 0)       churnScore += 0.25
      else if (sessions30d <= 2)   churnScore += 0.15

      if (openRate !== null && openRate < 0.1) churnScore += 0.20
      else if (openRate !== null && openRate < 0.3) churnScore += 0.10

      if (totalTx === 0) churnScore += 0.15

      churnScore = Math.min(1, churnScore)

      // ── RECRUITMENT SCORE ────────────────────────────────────────
      // Probabilité de recruter dans les 30 prochains jours
      let recruitScore = 0

      if (directRecruits >= 3)    recruitScore += 0.40
      else if (directRecruits >= 1) recruitScore += 0.25

      const referralEvents = evts.filter(e =>
        ['referral_link_copied', 'referral_link_shared'].includes(e.event_type)
      ).length
      if (referralEvents >= 3)    recruitScore += 0.30
      else if (referralEvents >= 1) recruitScore += 0.15

      if (totalTx >= 5)           recruitScore += 0.15
      if (sessions30d >= 10)      recruitScore += 0.10
      if (networkSize >= 2)       recruitScore += 0.10

      recruitScore = Math.min(1, recruitScore)

      // ── SPEND POTENTIAL SCORE ────────────────────────────────────
      // Potentiel de dépenses supplémentaires non captées
      let spendScore = 0.5 // base : on suppose que tout le monde a du potentiel

      if (totalTx >= 10)          spendScore -= 0.20 // déjà très actif
      if (avgTx < 1000)           spendScore += 0.20 // petits achats → marge de croissance
      if (sessions30d >= 15)      spendScore -= 0.10 // très engagé → déjà capté
      if (preferredPayment === 'cash_confirmed') spendScore += 0.15 // paie en cash → pas encore dans le wallet

      spendScore = Math.max(0, Math.min(1, spendScore))

      // ── TRIGGER DOMINANT ─────────────────────────────────────────
      // Phase 1 : inférence par signaux comportementaux
      const triggerSignals: Record<string, number> = {
        belonging: 0,
        status:    0,
        security:  0,
        fomo:      0,
        identity:  0,
        certainty: 0,
        autonomy:  0,
      }

      // Belonging (T2) : voit son réseau, partage, recrute
      const networkViews = evts.filter(e => e.event_type === 'network_viewed').length
      if (networkViews >= 5)     triggerSignals.belonging += 0.30
      if (referralEvents >= 2)   triggerSignals.belonging += 0.25
      if (directRecruits >= 2)   triggerSignals.belonging += 0.20

      // Status (T3) : voit son réseau et son rang, recrute pour grandir
      if (networkViews >= 3 && directRecruits >= 1) triggerSignals.status += 0.30
      const upgradeViews = evts.filter(e => e.event_type === 'upgrade_page_viewed').length
      if (upgradeViews >= 2)     triggerSignals.status += 0.20

      // Security (T1) : vérifie son wallet fréquemment, petits montants
      const walletViews = evts.filter(e => e.event_type === 'wallet_viewed').length
      if (walletViews >= 5)      triggerSignals.security += 0.30
      if (avgTx < 500)           triggerSignals.security += 0.20

      // FOMO (T4) : répond vite aux notifications, fréquence élevée
      const fastOpens = evts.filter(e => {
        if (e.event_type !== 'notification_opened') return false
        const delay = e.metadata?.delay_seconds as number | undefined
        return delay !== undefined && delay < 300 // ouvert en moins de 5 minutes
      }).length
      if (fastOpens >= 3)        triggerSignals.fomo += 0.35
      if (openRate && openRate > 0.6) triggerSignals.fomo += 0.20

      // Identity (T6) : a complété son profil, partage son code
      const profileUpdates = evts.filter(e => e.event_type === 'profile_updated').length
      if (profileUpdates >= 1)   triggerSignals.identity += 0.25
      if (referralEvents >= 1)   triggerSignals.identity += 0.15

      // Certainty (T5) : lit les pages d'info, sessions longues
      const merchantViews = evts.filter(e => e.event_type === 'merchant_profile_viewed').length
      if (merchantViews >= 3)    triggerSignals.certainty += 0.25

      // Autonomy (T7) : utilise wallet GF (contrôle total), retire régulièrement
      if (preferredPayment === 'wallet_gf') triggerSignals.autonomy += 0.30

      // Déterminer le trigger dominant
      const maxTrigger = Object.entries(triggerSignals)
        .sort((a, b) => b[1] - a[1])[0]

      const dominantTrigger = maxTrigger[1] > 0.1 ? maxTrigger[0] : 'unknown'
      const triggerConfidence = Math.min(1, maxTrigger[1])

      // ── Construire l'update ──────────────────────────────────────
      updates.push({
        user_id:              uid,
        dominant_trigger:     dominantTrigger,
        trigger_confidence:   +triggerConfidence.toFixed(3),
        trigger_signals:      triggerSignals,
        churn_score:          +churnScore.toFixed(3),
        recruitment_score:    +recruitScore.toFixed(3),
        spend_potential_score: +spendScore.toFixed(3),
        days_since_last_tx:   daysSinceTx < 999 ? daysSinceTx : null,
        total_transactions:   totalTx,
        total_gmv_fcfa:       totalGmv,
        avg_transaction_fcfa: avgTx,
        network_size:         networkSize,
        direct_recruits:      directRecruits,
        notification_open_rate: openRate !== null ? +openRate.toFixed(3) : null,
        sessions_last_30d:    sessions30d,
        preferred_payment:    preferredPayment,
        model_version:        'heuristic_v1',
        last_computed_at:     now.toISOString(),
        computation_notes:    null,
      })

      startReport.processed++
    } catch {
      startReport.errors++
    }
  }

  // ── Upsert en batch ───────────────────────────────────────────────
  if (updates.length > 0) {
    // Batch de 100 pour éviter les timeouts
    const batchSize = 100
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await svc.from('user_ai_profile').upsert(batch, { onConflict: 'user_id' })
    }
  }

  startReport.duration_ms = Date.now() - t0

  return NextResponse.json({
    success:   true,
    timestamp: now.toISOString(),
    ...startReport,
    // Résumé des distributions de triggers
    trigger_distribution: Object.fromEntries(
      ['belonging', 'status', 'security', 'fomo', 'identity', 'certainty', 'autonomy', 'unknown']
        .map(t => [t, updates.filter(u => u.dominant_trigger === t).length])
    ),
  })
}

// ── Helper ─────────────────────────────────────────────────────────
function groupBy<T extends Record<string, unknown>>(
  arr: T[],
  key: string
): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key])
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
