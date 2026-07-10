/**
 * lib/ai/admin-digest.ts
 *
 * Générateur de rapport IA quotidien pour GreenFlame.
 *
 * Collecte toutes les métriques clés de la plateforme,
 * les envoie à Claude Opus qui rédige un diagnostic complet en français,
 * puis stocke le résultat dans admin_digests.
 *
 * Appelé par :
 *   - Vercel Cron  → /api/cron/daily-digest (7h UTC = 8h Cotonou)
 *   - Admin manuel → /api/admin/trigger-digest
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DigestMetrics {
  date:              string    // YYYY-MM-DD
  // Transactions hier
  txCountYesterday:  number
  gmvYesterday:      number
  commYesterday:     number
  completionRate:    number    // % transactions completed
  // Transactions aujourd'hui (partiel si matin)
  txCountToday:      number
  gmvToday:          number
  // Utilisateurs
  totalUsers:        number
  newUsersYesterday: number
  // Marchands
  activeMerchants:   number
  proMerchants:      number
  vipMerchants:      number
  // KYC
  kycPending:        number
  kycNeedsReview:    number   // IA dit "needs_review"
  // Fraude
  fraudHigh:         number   // alertes haute non vérifiées
  fraudMedium:       number   // alertes moyennes non vérifiées
  // Finance
  pendingWithdrawals:   number
  spilloverMTD:         number
  platformRevenueMTD:   number
  subscriptionRevenue:  number
  voucherRevenue:       number
  // Communauté
  networkSize:       number
}

export interface DigestResult {
  summary:         string
  findings:        string[]
  recommendations: string[]
  risk_level:      'normal' | 'attention' | 'alert'
}

// ── Collecte des métriques ─────────────────────────────────────────────────

export async function collectMetrics(): Promise<DigestMetrics> {
  const svc = createServiceClient()
  const now = new Date()

  // Fenêtres de temps
  const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    // Transactions hier
    txYesterdayRes,
    txYesterdayTotal,
    // Transactions aujourd'hui
    txTodayRes,
    // Utilisateurs
    totalUsersRes,
    newUsersRes,
    // Marchands
    activeMerchRes,
    proMerchRes,
    vipMerchRes,
    // KYC
    kycPendingRes,
    kycReviewRes,
    // Fraude
    fraudHighRes,
    fraudMedRes,
    // Finance
    pendingWdRes,
    spilloverRes,
    subsRevRes,
    voucherRevRes,
    // Communauté
    networkRes,
  ] = await Promise.all([
    // Transactions hier complétées
    svc.rpc('admin_stats_period', {
      p_from: yesterdayStart.toISOString(),
      p_to:   todayStart.toISOString(),
    }),
    // Toutes les transactions hier (pour completion rate)
    svc.from('transactions')
      .select('status', { count: 'exact', head: false })
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString()),
    // Aujourd'hui
    svc.rpc('admin_stats_period', {
      p_from: todayStart.toISOString(),
      p_to:   now.toISOString(),
    }),
    // Utilisateurs total
    svc.from('users').select('*', { count: 'exact', head: true }),
    // Nouveaux hier
    svc.from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString()),
    // Marchands actifs
    svc.from('merchants').select('*', { count: 'exact', head: true }).eq('is_active', true),
    // Pro
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'pro').gt('subscription_expires_at', now.toISOString()),
    // VIP
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'vip').gt('subscription_expires_at', now.toISOString()),
    // KYC pending
    svc.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    // KYC needs_review (IA)
    svc.from('kyc_submissions').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').eq('ai_pre_decision', 'needs_review'),
    // Fraude high
    svc.from('transactions').select('*', { count: 'exact', head: true })
      .eq('fraud_level', 'high').eq('fraud_reviewed', false),
    // Fraude medium
    svc.from('transactions').select('*', { count: 'exact', head: true })
      .eq('fraud_level', 'medium').eq('fraud_reviewed', false),
    // Retraits en attente
    svc.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    // Spillover ce mois
    svc.from('spillover_fund').select('amount_fcfa').gte('created_at', monthStart.toISOString()),
    // Revenus abonnements
    svc.from('merchant_subscriptions').select('amount_fcfa'),
    // Frais bons de retrait
    svc.from('withdrawal_vouchers').select('greenflame_fee_fcfa').eq('status', 'redeemed'),
    // Taille réseau
    svc.from('network_tree').select('*', { count: 'exact', head: true }),
  ])

  const yesterdayStats = (txYesterdayRes.data as { gmv: number; commissions: number } | null) ?? { gmv: 0, commissions: 0 }
  const todayStats     = (txTodayRes.data     as { gmv: number; commissions: number } | null) ?? { gmv: 0, commissions: 0 }

  const allYesterdayTx = txYesterdayTotal.data ?? []
  const completedCount = allYesterdayTx.filter((t: { status: string }) => t.status === 'completed').length
  const totalCount     = allYesterdayTx.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const spilloverMTD  = (spilloverRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)
  const platformMTD   = Math.floor((yesterdayStats.commissions ?? 0) * 0.45)
  const subsRevenue   = (subsRevRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)
  const voucherRev    = (voucherRevRes.data ?? []).reduce((s: number, r: { greenflame_fee_fcfa: number }) => s + (r.greenflame_fee_fcfa ?? 0), 0)

  return {
    date:              yesterdayStart.toISOString().slice(0, 10),
    txCountYesterday:  completedCount,
    gmvYesterday:      yesterdayStats.gmv ?? 0,
    commYesterday:     yesterdayStats.commissions ?? 0,
    completionRate,
    txCountToday:      todayStats.gmv > 0 ? Math.round((todayStats.gmv / Math.max(1, yesterdayStats.gmv)) * completedCount) : 0,
    gmvToday:          todayStats.gmv ?? 0,
    totalUsers:        totalUsersRes.count  ?? 0,
    newUsersYesterday: newUsersRes.count    ?? 0,
    activeMerchants:   activeMerchRes.count ?? 0,
    proMerchants:      proMerchRes.count    ?? 0,
    vipMerchants:      vipMerchRes.count    ?? 0,
    kycPending:        kycPendingRes.count  ?? 0,
    kycNeedsReview:    kycReviewRes.count   ?? 0,
    fraudHigh:         fraudHighRes.count   ?? 0,
    fraudMedium:       fraudMedRes.count    ?? 0,
    pendingWithdrawals: pendingWdRes.count  ?? 0,
    spilloverMTD,
    platformRevenueMTD: platformMTD,
    subscriptionRevenue: subsRevenue,
    voucherRevenue:      voucherRev,
    networkSize:         networkRes.count ?? 0,
  }
}

// ── Analyse Claude ─────────────────────────────────────────────────────────

export async function generateDigestWithClaude(metrics: DigestMetrics): Promise<DigestResult> {
  const client = new Anthropic()

  const fmt = (n: number) => n.toLocaleString('fr-FR')

  const prompt = `Tu es l'analyste IA de GreenFlame, une fintech communautaire opérant au Bénin (FCFA).
Génère le rapport de performance quotidien du ${new Date(metrics.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}.
Ton audience : l'équipe fondatrice (Aurel DOSSA, co-fondateur technique).
Ton ton : concis, professionnel, direct. Ni trop formel ni trop décontracté.

━━━ MÉTRIQUES PLATEFORME ━━━

Transactions (hier) :
  • ${fmt(metrics.txCountYesterday)} transactions complétées | Taux de succès : ${metrics.completionRate}%
  • GMV : ${fmt(metrics.gmvYesterday)} FCFA | Commissions : ${fmt(metrics.commYesterday)} FCFA
  • Ce matin (partiel) : ${fmt(metrics.gmvToday)} FCFA déjà encaissés

Membres & Réseau :
  • Total : ${fmt(metrics.totalUsers)} membres | +${metrics.newUsersYesterday} hier
  • Parrainés (communauté) : ${fmt(metrics.networkSize)} membres
  • Marchands actifs : ${metrics.activeMerchants} (dont ${metrics.proMerchants} Pro · ${metrics.vipMerchants} VIP)

KYC :
  • En attente de validation : ${metrics.kycPending}
  • IA dit "à vérifier manuellement" : ${metrics.kycNeedsReview}

Sécurité :
  • Alertes fraude haute (non revues) : ${metrics.fraudHigh}
  • Alertes fraude moyenne (non revues) : ${metrics.fraudMedium}

Finance :
  • Retraits en attente : ${metrics.pendingWithdrawals}
  • Revenu plateforme (mois) : ${fmt(metrics.platformRevenueMTD)} FCFA
  • Abonnements marchands : ${fmt(metrics.subscriptionRevenue)} FCFA
  • Frais bons de retrait : ${fmt(metrics.voucherRevenue)} FCFA
  • Spillover ce mois : ${fmt(metrics.spilloverMTD)} FCFA

━━━ INSTRUCTIONS ━━━

Réponds UNIQUEMENT avec un JSON valide :
{
  "summary": "2-3 phrases résumant la journée d'hier et l'état actuel de la plateforme. Chiffres clés inclus.",
  "findings": [
    "Point clé 1 (avec chiffre précis si possible)",
    "Point clé 2",
    "Point clé 3",
    "Point clé 4 (optionnel)",
    "Point clé 5 (optionnel)"
  ],
  "recommendations": [
    "Action concrète à faire aujourd'hui",
    "Deuxième action si pertinente"
  ],
  "risk_level": "normal" | "attention" | "alert"
}

risk_level :
  • "alert"     — fraudes high > 0, ou retraits > 10, ou taux succès < 70%
  • "attention" — KYC en attente > 20, ou fraudes medium > 5, ou 0 transactions hier
  • "normal"    — tout va bien

Findings : max 5 items. Chaque item commence par une emoji pertinente.
Recommendations : max 3 items. Formulées comme actions concrètes ("Valider les X KYC...", "Contacter le marchand Y...", etc.).
N'invente pas de données. Base-toi uniquement sur les métriques fournies.`

  try {
    const response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text      = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON Claude')

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const VALID_RISKS = ['normal', 'attention', 'alert'] as const
    const risk = VALID_RISKS.includes(parsed.risk_level as typeof VALID_RISKS[number])
      ? (parsed.risk_level as typeof VALID_RISKS[number])
      : 'normal'

    return {
      summary:         typeof parsed.summary === 'string' ? parsed.summary.slice(0, 800) : '',
      findings:        Array.isArray(parsed.findings)
                         ? (parsed.findings as string[]).filter(f => typeof f === 'string').slice(0, 5)
                         : [],
      recommendations: Array.isArray(parsed.recommendations)
                         ? (parsed.recommendations as string[]).filter(r => typeof r === 'string').slice(0, 3)
                         : [],
      risk_level:      risk,
    }

  } catch (err) {
    console.error('[DIGEST] Erreur Claude :', err instanceof Error ? err.message : err)

    // Fallback sans IA — rapport basique basé sur les chiffres
    const riskLevel: DigestResult['risk_level'] =
      metrics.fraudHigh > 0 || metrics.completionRate < 70 ? 'alert' :
      metrics.kycPending > 20 || metrics.fraudMedium > 5   ? 'attention' :
                                                              'normal'
    return {
      summary: `Hier : ${fmt(metrics.txCountYesterday)} transactions pour ${fmt(metrics.gmvYesterday)} FCFA (taux ${metrics.completionRate}%). ${metrics.totalUsers} membres inscrits, ${metrics.activeMerchants} marchands actifs. Analyse IA détaillée disponible dès configuration de la clé Anthropic.`,
      findings: [
        `💰 GMV hier : ${fmt(metrics.gmvYesterday)} FCFA — ${metrics.txCountYesterday} transactions`,
        `👥 ${metrics.newUsersYesterday} nouveau${metrics.newUsersYesterday > 1 ? 'x' : ''} membre${metrics.newUsersYesterday > 1 ? 's' : ''} inscrit${metrics.newUsersYesterday > 1 ? 's' : ''}`,
        `📋 KYC en attente : ${metrics.kycPending}`,
        `🔒 Alertes fraude : ${metrics.fraudHigh} haute · ${metrics.fraudMedium} moyenne`,
        `💸 ${metrics.pendingWithdrawals} retrait${metrics.pendingWithdrawals > 1 ? 's' : ''} en attente`,
      ].filter((_, i) => i < 5),
      recommendations: [
        ...(metrics.kycPending > 0  ? [`Valider les ${metrics.kycPending} KYC en attente sur /admin/kyc`]   : []),
        ...(metrics.fraudHigh > 0   ? [`Traiter les ${metrics.fraudHigh} alertes fraude haute immédiatement`] : []),
        ...(metrics.pendingWithdrawals > 0 ? [`Traiter ${metrics.pendingWithdrawals} retraits en attente`]   : []),
      ].slice(0, 3),
      risk_level: riskLevel,
    }
  }
}

// ── Fonction principale (génère + sauvegarde) ──────────────────────────────

export async function generateAndSaveDigest(triggeredBy: 'cron' | 'manual' = 'cron'): Promise<string> {
  const svc = createServiceClient()

  const metrics = await collectMetrics()
  const result  = await generateDigestWithClaude(metrics)

  const periodDate = metrics.date  // YYYY-MM-DD

  // Upsert (un seul digest par jour)
  const { data, error } = await svc.from('admin_digests').upsert({
    period_date:      periodDate,
    generated_at:     new Date().toISOString(),
    generated_by:     triggeredBy,
    summary:          result.summary,
    findings:         result.findings,
    recommendations:  result.recommendations,
    risk_level:       result.risk_level,
    metrics_snapshot: metrics,
  }, { onConflict: 'period_date' }).select('id').single()

  if (error) throw new Error(`DB error: ${error.message}`)

  console.log(`[DIGEST] Rapport du ${periodDate} généré (${result.risk_level}) par ${triggeredBy}`)
  return data?.id ?? ''
}
