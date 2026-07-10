/**
 * lib/ai/fraud-detector.ts
 *
 * Détecteur de fraude IA pour les transactions GreenFlame.
 *
 * Principe :
 *   1. Collecte le contexte historique de l'acheteur depuis Supabase
 *   2. Envoie à Claude Opus pour analyse contextuelle et narrative
 *   3. Met à jour la transaction avec le score, niveau et explication
 *
 * Appel : fire-and-forget APRÈS création de la transaction.
 * Impact sur la latence de paiement : zéro.
 *
 * Flags possibles :
 *   AMOUNT_SPIKE        — montant ≥ 4× la moyenne historique
 *   HIGH_VELOCITY       — ≥ 4 transactions dans les 10 dernières minutes
 *   NEW_ACCOUNT_BIG_TX  — compte < 14 jours + montant > 25 000 FCFA
 *   MERCHANT_FREQUENCY  — ≥ 5 transactions au même marchand dans l'heure
 *   PATTERN_ANOMALY     — combinaison suspecte de facteurs
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────

export type FraudLevel = 'low' | 'medium' | 'high'

export interface FraudResult {
  fraud_score:     number
  fraud_level:     FraudLevel
  fraud_flags:     string[]
  fraud_narrative: string
}

// ── Contexte historique ────────────────────────────────────────────────────

interface TxContext {
  recentCount10min:  number   // transactions dans les 10 dernières minutes
  count30d:          number   // transactions dans les 30 derniers jours
  avgAmount30d:      number   // montant moyen sur 30j (0 si premier achat)
  maxAmount30d:      number   // montant max sur 30j
  sameM_1h:          number   // transactions chez ce marchand dans l'heure
  accountAgeDays:    number   // âge du compte en jours
}

async function fetchContext(
  svc:        ReturnType<typeof createServiceClient>,
  buyerId:    string,
  merchantId: string,
): Promise<TxContext> {

  const now     = new Date()
  const t10min  = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
  const t1h     = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const t30d    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [recent10, hist30, sameM, userRow] = await Promise.all([
    // Transactions récentes (10 min)
    svc.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .gte('created_at', t10min),

    // Historique 30j : count + avg + max
    svc.from('transactions')
      .select('amount_fcfa')
      .eq('buyer_id', buyerId)
      .in('status', ['completed', 'processing', 'pending'])
      .gte('created_at', t30d),

    // Fréquence chez ce marchand (1h)
    svc.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('merchant_id', merchantId)
      .gte('created_at', t1h),

    // Âge du compte
    svc.from('users')
      .select('created_at')
      .eq('id', buyerId)
      .single(),
  ])

  const amounts = (hist30.data ?? []).map(r => r.amount_fcfa as number)
  const avg30d  = amounts.length > 0
    ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length)
    : 0
  const max30d  = amounts.length > 0 ? Math.max(...amounts) : 0

  const createdAt    = userRow.data?.created_at ?? new Date().toISOString()
  const ageDays      = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000)

  return {
    recentCount10min: recent10.count ?? 0,
    count30d:         amounts.length,
    avgAmount30d:     avg30d,
    maxAmount30d:     max30d,
    sameM_1h:         sameM.count ?? 0,
    accountAgeDays:   ageDays,
  }
}

// ── Pré-flags (règles déterministes rapides) ───────────────────────────────

function preFlags(amountFcfa: number, ctx: TxContext): string[] {
  const flags: string[] = []

  if (ctx.avgAmount30d > 0 && amountFcfa >= ctx.avgAmount30d * 4) {
    flags.push('AMOUNT_SPIKE')
  }
  if (ctx.recentCount10min >= 4) {
    flags.push('HIGH_VELOCITY')
  }
  if (ctx.accountAgeDays < 14 && amountFcfa > 25_000) {
    flags.push('NEW_ACCOUNT_BIG_TX')
  }
  if (ctx.sameM_1h >= 5) {
    flags.push('MERCHANT_FREQUENCY')
  }

  return flags
}

// ── Analyse Claude ─────────────────────────────────────────────────────────

async function analyzeWithClaude(
  amountFcfa:    number,
  paymentMethod: string,
  ctx:           TxContext,
  prelimFlags:   string[],
): Promise<FraudResult> {

  const client = new Anthropic()

  const prompt = `Tu es l'analyste fraude de GreenFlame, une fintech opérant au Bénin (FCFA).
Donne une évaluation de risque pour cette transaction.

━━━ Contexte transaction ━━━
Montant          : ${amountFcfa.toLocaleString('fr-FR')} FCFA
Mode paiement    : ${paymentMethod}
Signaux rapides  : ${prelimFlags.length > 0 ? prelimFlags.join(', ') : 'aucun'}

━━━ Historique acheteur (30 jours) ━━━
Transactions     : ${ctx.count30d} (dont ${ctx.recentCount10min} dans les 10 dernières minutes)
Montant moyen    : ${ctx.avgAmount30d.toLocaleString('fr-FR')} FCFA
Montant maximum  : ${ctx.maxAmount30d.toLocaleString('fr-FR')} FCFA
Âge du compte    : ${ctx.accountAgeDays} jours

━━━ Contexte marchand ━━━
Transactions chez ce marchand (1h) : ${ctx.sameM_1h}

Réponds UNIQUEMENT avec un objet JSON valide :
{
  "fraud_score": 0.00,
  "fraud_level": "low" | "medium" | "high",
  "fraud_flags": ["FLAG_1"],
  "fraud_narrative": "Explication concise en français (max 60 mots) pour l'admin"
}

Flags disponibles : AMOUNT_SPIKE, HIGH_VELOCITY, NEW_ACCOUNT_BIG_TX, MERCHANT_FREQUENCY, PATTERN_ANOMALY.
N'invente pas de flags. Utilise PATTERN_ANOMALY si la combinaison est suspecte sans flag précis.

Seuils :
• low    (0.00–0.34) : comportement normal ou légèrement inhabituel, aucune action requise
• medium (0.35–0.64) : anomalie réelle, mérite une revue admin sans urgence
• high   (0.65–1.00) : signal fort de fraude, escalade immédiate à l'admin

Contexte béninois : les premiers achats et les grosses transactions occasionnelles sont courants
lors des fêtes ou d'achat groupé. Sois précis mais évite les faux positifs.`

  try {
    const response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text      = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON Claude')

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const VALID_LEVELS: FraudLevel[] = ['low', 'medium', 'high']
    const level = VALID_LEVELS.includes(parsed.fraud_level as FraudLevel)
      ? (parsed.fraud_level as FraudLevel)
      : 'low'

    const rawFlags  = Array.isArray(parsed.fraud_flags)
      ? (parsed.fraud_flags as string[]).filter(f => typeof f === 'string')
      : []

    // Merge avec les pré-flags pour ne rien perdre
    const mergedFlags = [...new Set([...prelimFlags, ...rawFlags])]

    return {
      fraud_score:     typeof parsed.fraud_score === 'number'
                         ? Math.min(1, Math.max(0, parsed.fraud_score))
                         : prelimFlags.length > 0 ? 0.4 : 0.1,
      fraud_level:     level,
      fraud_flags:     mergedFlags,
      fraud_narrative: typeof parsed.fraud_narrative === 'string'
                         ? parsed.fraud_narrative.slice(0, 500)
                         : 'Analyse automatique effectuée.',
    }

  } catch (err) {
    console.error('[FRAUD-AI] Erreur Claude :', err instanceof Error ? err.message : err)

    // Fallback : utiliser les pré-flags pour estimer le score
    const score = Math.min(0.9, prelimFlags.length * 0.25)
    return {
      fraud_score:     score,
      fraud_level:     score >= 0.65 ? 'high' : score >= 0.35 ? 'medium' : 'low',
      fraud_flags:     prelimFlags,
      fraud_narrative: 'Analyse IA indisponible — pré-signaux automatiques appliqués.',
    }
  }
}

// ── Fonction publique (fire-and-forget) ────────────────────────────────────

/**
 * Analyse une transaction pour détecter la fraude et met à jour la DB.
 * Doit être appelée APRÈS la création de la transaction, sans await.
 *
 * Usage :
 *   analyzeTransactionFraud({ transactionId, buyerId, merchantId, amountFcfa, paymentMethod })
 *     .catch(() => {})
 */
export async function analyzeTransactionFraud({
  transactionId,
  buyerId,
  merchantId,
  amountFcfa,
  paymentMethod,
}: {
  transactionId: string
  buyerId:       string
  merchantId:    string
  amountFcfa:    number
  paymentMethod: string
}): Promise<void> {

  const svc = createServiceClient()

  // 1. Collecter le contexte historique
  const ctx = await fetchContext(svc, buyerId, merchantId)

  // 2. Pré-flags déterministes
  const flags = preFlags(amountFcfa, ctx)

  // 3. Si pas d'API key : utiliser seulement les pré-flags
  let result: FraudResult

  if (process.env.ANTHROPIC_API_KEY) {
    result = await analyzeWithClaude(amountFcfa, paymentMethod, ctx, flags)
  } else {
    // Fallback sans IA : score basé sur les pré-flags
    const score = Math.min(0.9, flags.length * 0.25)
    result = {
      fraud_score:     score,
      fraud_level:     score >= 0.65 ? 'high' : score >= 0.35 ? 'medium' : 'low',
      fraud_flags:     flags,
      fraud_narrative: flags.length > 0
        ? `Signaux automatiques détectés : ${flags.join(', ')}. Analyse IA activée dès configuration de la clé API.`
        : 'Transaction dans les normes habituelles.',
    }
  }

  // 4. Mettre à jour la transaction
  const { error } = await svc.from('transactions').update({
    fraud_score:       result.fraud_score,
    fraud_level:       result.fraud_level,
    fraud_flags:       result.fraud_flags,
    fraud_narrative:   result.fraud_narrative,
    fraud_analyzed_at: new Date().toISOString(),
  }).eq('id', transactionId)

  if (error) {
    console.error('[FRAUD-AI] Échec mise à jour DB :', error.message)
    return
  }

  const emoji = result.fraud_level === 'high' ? '🚨' : result.fraud_level === 'medium' ? '⚠️' : '✅'
  console.log(
    `[FRAUD-AI] ${transactionId} → ${emoji} ${result.fraud_level} (${Math.round(result.fraud_score * 100)}%) — ${result.fraud_flags.join(', ') || 'clean'}`
  )
}
