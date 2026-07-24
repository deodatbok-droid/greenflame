/**
 * lib/ai/merchant-report.ts
 *
 * Génère le rapport analytique IA mensuel d'un marchand VIP.
 * Collecte ses métriques, appelle Claude, stocke dans merchant_reports.
 *
 * Appelé par : /api/merchant/generate-report (POST)
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MerchantReportMetrics {
  merchantName:      string
  periodLabel:       string   // ex: "juillet 2026"
  periodDate:        string   // YYYY-MM-DD (1er du mois)
  // Volume
  gmv:               number
  gmvPrevMonth:      number
  net:               number
  txCount:           number
  avgBasket:         number
  // Clients
  uniqueBuyers:      number
  newBuyers:         number
  returningBuyers:   number
  retentionRate:     number   // %
  // Produits
  topProducts:       { name: string; revenue: number; qty: number }[]
  // Paiement
  paymentMethods:    { method: string; count: number; pct: number }[]
  // Meilleurs moments
  bestDow:           string   // ex: "Lundi"
  bestHour:          string   // ex: "14h"
}

export interface MerchantReportResult {
  summary:         string
  highlights:      string[]
  improvements:    string[]
  recommendations: string[]
  risk_level:      'normal' | 'attention' | 'alert'
}

// ── Collecte des métriques du marchand ─────────────────────────────────────────

export async function collectMerchantMetrics(merchantId: string): Promise<MerchantReportMetrics> {
  const svc = createServiceClient()
  const now = new Date()

  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd   = monthStart

  // Fetch 2 mois de transactions
  const { data: rawTxs } = await svc
    .from('transactions')
    .select('id, amount_fcfa, commission_total, created_at, buyer_id, payment_method')
    .eq('merchant_id', merchantId)
    .eq('status', 'completed')
    .gte('created_at', prevMonthStart.toISOString())
    .order('created_at', { ascending: true })

  const allTxs = rawTxs ?? []

  const inRange = (t: { created_at: string }, from: Date, to: Date) => {
    const d = new Date(t.created_at)
    return d >= from && d < to
  }

  const monthTxs     = allTxs.filter(t => inRange(t, monthStart, now))
  const prevMonthTxs = allTxs.filter(t => inRange(t, prevMonthStart, prevMonthEnd))

  const gmv         = monthTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const gmvPrev     = prevMonthTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const net         = monthTxs.reduce((s, t) => s + t.amount_fcfa - t.commission_total, 0)
  const txCount     = monthTxs.length
  const avgBasket   = txCount > 0 ? Math.round(gmv / txCount) : 0

  // Clients ce mois
  const buyersThisMonth = new Set(monthTxs.map(t => t.buyer_id))
  const buyersPrevMonth = new Set(prevMonthTxs.map(t => t.buyer_id))
  const returningBuyers = [...buyersThisMonth].filter(id => buyersPrevMonth.has(id)).length
  const newBuyers       = Math.max(0, buyersThisMonth.size - returningBuyers)
  const retentionRate   = buyersPrevMonth.size > 0
    ? Math.round((returningBuyers / buyersPrevMonth.size) * 100) : 0

  // Produits
  const txIds = monthTxs.map(t => t.id)
  const { data: rawItems } = txIds.length > 0
    ? await svc
        .from('transaction_items')
        .select('product_name, quantity, unit_price_fcfa')
        .in('transaction_id', txIds)
    : { data: [] }
  const productMap: Record<string, { revenue: number; qty: number }> = {}
  for (const item of rawItems ?? []) {
    const name = item.product_name ?? 'Autre'
    if (!productMap[name]) productMap[name] = { revenue: 0, qty: 0 }
    productMap[name].revenue += (item.unit_price_fcfa ?? 0) * (item.quantity ?? 1)
    productMap[name].qty     += item.quantity ?? 1
  }
  const topProducts = Object.entries(productMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Méthodes de paiement
  const methodMap: Record<string, number> = {}
  for (const tx of monthTxs) {
    const m = tx.payment_method ?? 'autre'
    methodMap[m] = (methodMap[m] ?? 0) + 1
  }
  const paymentMethods = Object.entries(methodMap)
    .map(([method, count]) => ({
      method,
      count,
      pct: txCount > 0 ? Math.round((count / txCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Meilleur jour/heure
  const DOW = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const dowMap: number[] = Array(7).fill(0)
  const hourMap: number[] = Array(24).fill(0)
  for (const tx of monthTxs) {
    const d = new Date(tx.created_at)
    dowMap[d.getDay()]  += tx.amount_fcfa
    hourMap[d.getHours()] += tx.amount_fcfa
  }
  const bestDowIdx  = dowMap.indexOf(Math.max(...dowMap))
  const bestHourIdx = hourMap.indexOf(Math.max(...hourMap))

  // Nom du marchand
  const { data: merchant } = await svc
    .from('merchants')
    .select('business_name')
    .eq('id', merchantId)
    .single()

  const periodLabel = monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const periodDate  = monthStart.toISOString().slice(0, 10)

  return {
    merchantName:    merchant?.business_name ?? 'Votre commerce',
    periodLabel,
    periodDate,
    gmv,
    gmvPrevMonth:    gmvPrev,
    net,
    txCount,
    avgBasket,
    uniqueBuyers:    buyersThisMonth.size,
    newBuyers,
    returningBuyers,
    retentionRate,
    topProducts,
    paymentMethods,
    bestDow:         DOW[bestDowIdx] ?? '—',
    bestHour:        `${bestHourIdx}h`,
  }
}

// ── Génération Claude ──────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  momo: 'MTN MoMo', moov: 'Moov Money', cash: 'Espèces',
  wallet: 'Portefeuille GreenFlame', orange: 'Orange Money', autre: 'Autre',
}

export async function generateMerchantReportWithClaude(m: MerchantReportMetrics): Promise<MerchantReportResult> {
  const client = new Anthropic()
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  const diff = m.gmvPrevMonth > 0
    ? Math.round(((m.gmv - m.gmvPrevMonth) / m.gmvPrevMonth) * 100)
    : null

  const prompt = `Tu es le conseiller d'activité de GreenFlame. Tu parles directement au marchand en "vous".
Ton rôle : expliquer comment s'est passé ce mois, en langage simple et sans jargon.
Pas de termes comme "KPI", "GMV", "taux de conversion" — tu dis "chiffre d'affaires", "clients", "ventes".
Ton ton : bienveillant, concret, encourageant mais honnête.

━━━ DONNÉES DU MOIS DE ${m.periodLabel.toUpperCase()} ━━━
Commerce : ${m.merchantName}

Ventes :
  • Chiffre d'affaires total : ${fmt(m.gmv)} FCFA${diff !== null ? ` (${diff >= 0 ? '+' : ''}${diff}% vs mois dernier)` : ''}
  • Revenu net après frais GreenFlame : ${fmt(m.net)} FCFA
  • Nombre de ventes : ${m.txCount}
  • Panier moyen par vente : ${fmt(m.avgBasket)} FCFA

Clients :
  • Clients uniques ce mois : ${m.uniqueBuyers}
  • Nouveaux clients : ${m.newBuyers}
  • Clients fidèles (revenus depuis le mois dernier) : ${m.returningBuyers} (${m.retentionRate}% de vos anciens clients ont racheté)

${m.topProducts.length > 0 ? `Produits les plus vendus :
${m.topProducts.map((p, i) => `  ${i + 1}. ${p.name} — ${fmt(p.revenue)} FCFA (${p.qty} unités)`).join('\n')}` : ''}

Modes de paiement :
${m.paymentMethods.map(p => `  • ${METHOD_LABELS[p.method] ?? p.method} : ${p.pct}% (${p.count} ventes)`).join('\n')}

Meilleur moment : ${m.bestDow} — heure de pointe : ${m.bestHour}

━━━ INSTRUCTIONS ━━━

Réponds UNIQUEMENT avec un JSON valide :
{
  "summary": "2-3 phrases résumant le mois. Chiffres clés intégrés naturellement dans le texte. Commence par ex: 'Ce mois de [période], votre activité...'",
  "highlights": [
    "Point fort 1 — commence par une emoji, formule comme un constat positif avec le chiffre",
    "Point fort 2",
    "Point fort 3 (optionnel)"
  ],
  "improvements": [
    "Axe d'amélioration 1 — commence par une emoji ⚠️ ou 💡, explique POURQUOI c'est important sans jargon",
    "Axe d'amélioration 2 (optionnel)"
  ],
  "recommendations": [
    "Action concrète 1 — formule comme 'Pour améliorer X, essayez de...' ou 'Cette semaine, pensez à...'",
    "Action concrète 2",
    "Action concrète 3 (optionnel)"
  ],
  "risk_level": "normal" | "attention" | "alert"
}

risk_level :
  • "alert"     — chiffre d'affaires en baisse de plus de 30% OU 0 client fidèle OU 0 vente
  • "attention" — baisse entre 10% et 30% OU taux de fidélité < 20%
  • "normal"    — activité stable ou en croissance

Highlights : max 3 items. Improvements : max 2 items. Recommendations : max 3 items.
N'invente pas de données. Base-toi uniquement sur les chiffres fournis.`

  try {
    const response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 900,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text      = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON Claude')

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const VALID_RISKS = ['normal', 'attention', 'alert'] as const
    const risk = VALID_RISKS.includes(parsed.risk_level as typeof VALID_RISKS[number])
      ? (parsed.risk_level as typeof VALID_RISKS[number]) : 'normal'

    return {
      summary:         typeof parsed.summary === 'string' ? parsed.summary.slice(0, 800) : '',
      highlights:      Array.isArray(parsed.highlights)      ? (parsed.highlights as string[]).slice(0, 3) : [],
      improvements:    Array.isArray(parsed.improvements)    ? (parsed.improvements as string[]).slice(0, 2) : [],
      recommendations: Array.isArray(parsed.recommendations) ? (parsed.recommendations as string[]).slice(0, 3) : [],
      risk_level:      risk,
    }
  } catch (err) {
    console.error('[MERCHANT-REPORT] Erreur Claude :', err instanceof Error ? err.message : err)
    const fmt2 = (n: number) => n.toLocaleString('fr-FR')
    const risk: MerchantReportResult['risk_level'] =
      m.gmv === 0 ? 'alert' :
      (m.gmvPrevMonth > 0 && m.gmv < m.gmvPrevMonth * 0.7) ? 'attention' : 'normal'
    return {
      summary:         `En ${m.periodLabel}, ${m.merchantName} a réalisé ${fmt2(m.gmv)} FCFA de chiffre d'affaires sur ${m.txCount} ventes, pour un revenu net de ${fmt2(m.net)} FCFA.`,
      highlights:      [`💰 Chiffre d'affaires : ${fmt2(m.gmv)} FCFA`, `👥 ${m.uniqueBuyers} clients dont ${m.newBuyers} nouveaux`],
      improvements:    m.retentionRate < 30 ? ['💡 Votre taux de clients fidèles est faible — pensez à proposer des avantages à vos clients réguliers.'] : [],
      recommendations: ['📱 Partagez votre lien GreenFlame pour attirer de nouveaux clients.'],
      risk_level:      risk,
    }
  }
}

// ── Génère + sauvegarde ────────────────────────────────────────────────────────

export async function generateAndSaveMerchantReport(merchantId: string): Promise<string> {
  const svc = createServiceClient()
  const metrics = await collectMerchantMetrics(merchantId)
  const result  = await generateMerchantReportWithClaude(metrics)

  const { data, error } = await svc
    .from('merchant_reports')
    .upsert({
      merchant_id:      merchantId,
      period_date:      metrics.periodDate,
      generated_at:     new Date().toISOString(),
      generated_by:     'manual',
      summary:          result.summary,
      highlights:       result.highlights,
      improvements:     result.improvements,
      recommendations:  result.recommendations,
      risk_level:       result.risk_level,
      metrics_snapshot: metrics,
    }, { onConflict: 'merchant_id,period_date' })
    .select('id')
    .single()

  if (error) throw new Error(`DB error: ${error.message}`)
  return data?.id ?? ''
}
