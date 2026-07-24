import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { MerchantComptablePdf, MerchantReportIaPdf } from '@/lib/exports/pdf-templates'
import { buildCsv, csvResponse, formatDate, formatTime, formatAmount } from '@/lib/exports/csv-utils'

const METHOD_LABELS: Record<string, string> = {
  momo: 'MTN MoMo', moov: 'Moov Money', cash: 'Espèces',
  wallet: 'Portefeuille GF', orange: 'Orange Money', autre: 'Autre',
}

// GET /api/merchant/export?type=comptable|rapport-ia&format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Aucun compte marchand' }, { status: 403 })

  const isHub = merchant.is_platform_hub ?? false
  const tier  = merchant.subscription_tier ?? 'free'
  const exp   = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  const isVip = isHub || (tier === 'vip' && exp !== null && exp > new Date())
  if (!isVip) return NextResponse.json({ error: 'Fonctionnalité VIP uniquement' }, { status: 403 })

  const params    = req.nextUrl.searchParams
  const type      = params.get('type')   ?? 'comptable'   // comptable | rapport-ia
  const format    = params.get('format') ?? 'csv'          // csv | pdf
  const fromParam = params.get('from')   ?? ''
  const toParam   = params.get('to')     ?? ''

  // Valider les dates
  const from = fromParam || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const to   = toParam   || new Date().toISOString().slice(0, 10)
  const fromIso = new Date(from + 'T00:00:00Z').toISOString()
  const toIso   = new Date(to   + 'T23:59:59Z').toISOString()

  const merchantName = merchant.business_name ?? 'Marchand'
  const periodLabel  = `${formatDate(fromIso)} – ${formatDate(toIso)}`
  const generatedAt  = new Date().toISOString()

  // ── RAPPORT IA ─────────────────────────────────────────────────────────────
  if (type === 'rapport-ia') {
    // Seul le PDF a du sens pour le rapport IA
    const now = new Date()
    const periodDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    const { data: report } = await supabase
      .from('merchant_reports')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('period_date', periodDate)
      .single()

    if (!report) {
      return NextResponse.json({ error: 'Aucun rapport disponible. Générez d\'abord le rapport IA.' }, { status: 404 })
    }

    const metrics = report.metrics_snapshot as Record<string, number | string>
    const pdfBuffer = await renderToBuffer(
      createElement(MerchantReportIaPdf, {
        merchantName,
        periodLabel: (report.metrics_snapshot as { periodLabel?: string })?.periodLabel ?? periodLabel,
        generatedAt: report.generated_at,
        summary:     report.summary ?? '',
        highlights:  (report.highlights as string[]) ?? [],
        improvements: (report.improvements as string[]) ?? [],
        recommendations: (report.recommendations as string[]) ?? [],
        risk_level:  report.risk_level as 'normal' | 'attention' | 'alert',
        metrics: {
          gmv:             Number(metrics.gmv ?? 0),
          net:             Number(metrics.net ?? 0),
          txCount:         Number(metrics.txCount ?? 0),
          avgBasket:       Number(metrics.avgBasket ?? 0),
          uniqueBuyers:    Number(metrics.uniqueBuyers ?? 0),
          newBuyers:       Number(metrics.newBuyers ?? 0),
          returningBuyers: Number(metrics.returningBuyers ?? 0),
          retentionRate:   Number(metrics.retentionRate ?? 0),
          bestDow:         String(metrics.bestDow ?? '—'),
          bestHour:        String(metrics.bestHour ?? '—'),
        },
      }) as ReactElement<DocumentProps>
    )

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-ia-${periodDate}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  }

  // ── RAPPORT COMPTABLE ──────────────────────────────────────────────────────
  const { data: rawTxs } = await supabase
    .from('transactions')
    .select('id, amount_fcfa, commission_total, created_at, payment_method, buyers:buyer_id(full_name)')
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })

  const txs = (rawTxs ?? []).map(t => ({
    ...t,
    buyers: Array.isArray(t.buyers)
      ? (t.buyers[0] as { full_name: string } | null) ?? null
      : (t.buyers as { full_name: string } | null),
  }))

  const slug = `${merchantName.replace(/\s+/g, '-').toLowerCase()}_${from}_${to}`

  // CSV
  if (format === 'csv') {
    const rows = txs.map(tx => [
      formatDate(tx.created_at),
      formatTime(tx.created_at),
      tx.id,
      tx.buyers?.full_name ?? 'Client',
      formatAmount(tx.amount_fcfa),
      formatAmount(tx.commission_total),
      formatAmount(tx.amount_fcfa - tx.commission_total),
      METHOD_LABELS[tx.payment_method ?? 'autre'] ?? tx.payment_method ?? 'Autre',
    ])
    const csv = buildCsv(
      ['Date', 'Heure', 'Référence', 'Client', 'Montant (FCFA)', 'Commission (FCFA)', 'Net reçu (FCFA)', 'Mode de paiement'],
      rows,
    )
    return csvResponse(csv, `releve-${slug}.csv`)
  }

  // PDF
  const pdfBuffer = await renderToBuffer(
    createElement(MerchantComptablePdf, {
      merchantName,
      periodLabel,
      from,
      to,
      txs,
      generatedAt,
    }) as ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="releve-${slug}.pdf"`,
      'Cache-Control':       'no-store',
    },
  })
}
