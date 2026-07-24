import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { AdminExportPdf, type AdminExportSection } from '@/lib/exports/pdf-templates'
import { buildCsv, csvResponse, formatDate, formatTime, formatAmount } from '@/lib/exports/csv-utils'

/**
 * POST /api/admin/export
 * Body: {
 *   datasets: string[],    // 'transactions' | 'commissions' | 'membres' | 'marchands' | 'retraits' | 'kyc' | 'spillover' | 'abonnements'
 *   format: 'csv' | 'pdf',
 *   from: 'YYYY-MM-DD',
 *   to:   'YYYY-MM-DD',
 * }
 */
export async function POST(req: NextRequest) {
  // Auth + rôle admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json() as {
    datasets: string[]
    format:   'csv' | 'pdf'
    from:     string
    to:       string
  }
  const { datasets, format, from, to } = body

  if (!datasets?.length) return NextResponse.json({ error: 'Aucun dataset sélectionné' }, { status: 400 })

  const fromIso = new Date(from + 'T00:00:00Z').toISOString()
  const toIso   = new Date(to   + 'T23:59:59Z').toISOString()
  const svc     = createServiceClient()
  const generatedAt = new Date().toISOString()

  // ── Collecte des données par dataset ──────────────────────────────────────
  const csvParts: string[] = []
  const pdfSections: AdminExportSection[] = []

  // ── Transactions ──────────────────────────────────────────────────────────
  if (datasets.includes('transactions')) {
    const { data } = await svc
      .from('transactions')
      .select('id, created_at, amount_fcfa, commission_total, payment_method, status, merchant_id, buyer_id, merchants:merchant_id(business_name), buyers:buyer_id(full_name)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(t => {
      const merchant = Array.isArray(t.merchants) ? t.merchants[0] : t.merchants
      const buyer    = Array.isArray(t.buyers)    ? t.buyers[0]    : t.buyers
      return [
        formatDate(t.created_at),
        formatTime(t.created_at),
        t.id,
        (merchant as { business_name?: string } | null)?.business_name ?? '—',
        (buyer    as { full_name?:    string } | null)?.full_name    ?? '—',
        formatAmount(t.amount_fcfa),
        formatAmount(t.commission_total),
        formatAmount(t.amount_fcfa - t.commission_total),
        t.payment_method ?? '—',
        t.status,
      ]
    })

    const headers = ['Date', 'Heure', 'ID', 'Marchand', 'Acheteur', 'Montant (FCFA)', 'Commission (FCFA)', 'Net marchand (FCFA)', 'Mode de paiement', 'Statut']
    const totalGmv  = (data ?? []).reduce((s, t) => s + t.amount_fcfa, 0)
    const totalComm = (data ?? []).reduce((s, t) => s + t.commission_total, 0)

    if (format === 'csv') {
      csvParts.push(`﻿=== TRANSACTIONS (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Transactions',
        headers,
        rows,
        summary: [
          { label: 'GMV total',       value: `${totalGmv.toLocaleString('fr-FR')} FCFA` },
          { label: 'Commissions',     value: `${totalComm.toLocaleString('fr-FR')} FCFA` },
          { label: 'Rev. GreenFlame', value: `${Math.round(totalComm * 0.45).toLocaleString('fr-FR')} FCFA` },
          { label: 'Nombre de tx',    value: rows.length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── Commissions & revenus ─────────────────────────────────────────────────
  if (datasets.includes('commissions')) {
    const { data } = await svc
      .from('wallet_ledger')
      .select('id, created_at, amount_fcfa, transaction_type, description, user_id, users:user_id(full_name)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })
      .limit(5000)

    const rows = (data ?? []).map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return [
        formatDate(e.created_at),
        (u as { full_name?: string } | null)?.full_name ?? '—',
        e.transaction_type ?? '—',
        formatAmount(e.amount_fcfa),
        e.description ?? '—',
      ]
    })

    const headers = ['Date', 'Bénéficiaire', 'Type', 'Montant (FCFA)', 'Description']
    const total = (data ?? []).reduce((s, e) => s + e.amount_fcfa, 0)

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== COMMISSIONS & REVENUS (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Commissions & revenus',
        headers,
        rows,
        summary: [{ label: 'Total distribué', value: `${total.toLocaleString('fr-FR')} FCFA` }],
      })
    }
  }

  // ── Membres ───────────────────────────────────────────────────────────────
  if (datasets.includes('membres')) {
    const { data } = await svc
      .from('users')
      .select('id, full_name, phone, role, created_at, is_active, upline_id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(u => [
      formatDate(u.created_at),
      u.id,
      u.full_name ?? '—',
      u.phone ?? '—',
      u.role ?? 'member',
      u.is_active ? 'Actif' : 'Inactif',
      u.upline_id ? 'Oui' : 'Non',
    ])

    const headers = ['Date inscription', 'ID', 'Nom', 'Téléphone', 'Rôle', 'Statut', 'Parrainé']

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== MEMBRES (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Membres inscrits',
        headers,
        rows,
        summary: [
          { label: 'Total inscrits',  value: rows.length.toLocaleString('fr-FR') },
          { label: 'Parrainés',       value: (data ?? []).filter(u => u.upline_id).length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── Marchands ─────────────────────────────────────────────────────────────
  if (datasets.includes('marchands')) {
    const { data } = await svc
      .from('merchants')
      .select('id, business_name, sector, subscription_tier, subscription_expires_at, is_active, created_at, users:user_id(full_name, phone)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(m => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users
      return [
        formatDate(m.created_at),
        m.id,
        m.business_name ?? '—',
        m.sector ?? '—',
        m.subscription_tier ?? 'free',
        m.subscription_expires_at ? formatDate(m.subscription_expires_at) : '—',
        m.is_active ? 'Actif' : 'Inactif',
        (u as { full_name?: string } | null)?.full_name ?? '—',
        (u as { phone?: string } | null)?.phone ?? '—',
      ]
    })

    const headers = ['Date création', 'ID', 'Commerce', 'Secteur', 'Plan', 'Expiration', 'Statut', 'Propriétaire', 'Téléphone']

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== MARCHANDS (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Marchands',
        headers,
        rows,
        summary: [
          { label: 'Total marchands', value: rows.length.toLocaleString('fr-FR') },
          { label: 'Actifs',          value: (data ?? []).filter(m => m.is_active).length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── Retraits ──────────────────────────────────────────────────────────────
  if (datasets.includes('retraits')) {
    const { data } = await svc
      .from('withdrawal_requests')
      .select('id, created_at, processed_at, amount_fcfa, status, method, users:user_id(full_name, phone)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(w => {
      const u = Array.isArray(w.users) ? w.users[0] : w.users
      return [
        formatDate(w.created_at),
        w.processed_at ? formatDate(w.processed_at) : '—',
        w.id,
        (u as { full_name?: string } | null)?.full_name ?? '—',
        (u as { phone?: string }    | null)?.phone ?? '—',
        formatAmount(w.amount_fcfa),
        w.method ?? '—',
        w.status,
      ]
    })

    const headers = ['Date demande', 'Date traitement', 'ID', 'Bénéficiaire', 'Téléphone', 'Montant (FCFA)', 'Mode', 'Statut']
    const total = (data ?? []).filter(w => w.status === 'completed').reduce((s, w) => s + w.amount_fcfa, 0)

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== RETRAITS (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Retraits',
        headers,
        rows,
        summary: [
          { label: 'Total traités', value: `${total.toLocaleString('fr-FR')} FCFA` },
          { label: 'En attente',    value: (data ?? []).filter(w => w.status === 'pending').length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── KYC ──────────────────────────────────────────────────────────────────
  if (datasets.includes('kyc')) {
    const { data } = await svc
      .from('kyc_submissions')
      .select('id, created_at, updated_at, status, ai_pre_decision, users:user_id(full_name, phone)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(k => {
      const u = Array.isArray(k.users) ? k.users[0] : k.users
      return [
        formatDate(k.created_at),
        k.id,
        (u as { full_name?: string } | null)?.full_name ?? '—',
        (u as { phone?: string } | null)?.phone ?? '—',
        k.ai_pre_decision ?? '—',
        k.status,
        k.updated_at ? formatDate(k.updated_at) : '—',
      ]
    })

    const headers = ['Date soumission', 'ID', 'Nom', 'Téléphone', 'Décision IA', 'Statut final', 'Date décision']

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== KYC (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Soumissions KYC',
        headers,
        rows,
        summary: [
          { label: 'Total',      value: rows.length.toLocaleString('fr-FR') },
          { label: 'Approuvés',  value: (data ?? []).filter(k => k.status === 'approved').length.toLocaleString('fr-FR') },
          { label: 'En attente', value: (data ?? []).filter(k => k.status === 'pending').length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── Spillover ─────────────────────────────────────────────────────────────
  if (datasets.includes('spillover')) {
    const { data } = await svc
      .from('spillover_fund')
      .select('id, created_at, amount_fcfa, reason, source_transaction_id')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(sp => [
      formatDate(sp.created_at),
      sp.id,
      formatAmount(sp.amount_fcfa),
      sp.reason ?? '—',
      sp.source_transaction_id ?? '—',
    ])

    const headers = ['Date', 'ID', 'Montant (FCFA)', 'Motif', 'Transaction source']
    const total = (data ?? []).reduce((s, sp) => s + sp.amount_fcfa, 0)

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== SPILLOVER (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Spillover Fund',
        headers,
        rows,
        summary: [{ label: 'Total spillover', value: `${total.toLocaleString('fr-FR')} FCFA` }],
      })
    }
  }

  // ── Abonnements ───────────────────────────────────────────────────────────
  if (datasets.includes('abonnements')) {
    const { data } = await svc
      .from('merchant_subscriptions')
      .select('id, created_at, tier, duration_months, amount_fcfa, payment_method, merchants:merchant_id(business_name)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false })

    const rows = (data ?? []).map(a => {
      const m = Array.isArray(a.merchants) ? a.merchants[0] : a.merchants
      return [
        formatDate(a.created_at),
        a.id,
        (m as { business_name?: string } | null)?.business_name ?? '—',
        a.tier ?? '—',
        a.duration_months ?? '—',
        formatAmount(a.amount_fcfa),
        a.payment_method ?? '—',
      ]
    })

    const headers = ['Date', 'ID', 'Marchand', 'Plan', 'Durée (mois)', 'Montant (FCFA)', 'Mode de paiement']
    const total = (data ?? []).reduce((s, a) => s + (a.amount_fcfa ?? 0), 0)

    if (format === 'csv') {
      csvParts.push(`\r\n\r\n=== ABONNEMENTS MARCHANDS (${from} → ${to}) ===\r\n`)
      csvParts.push(buildCsv(headers, rows).replace('﻿', ''))
    } else {
      pdfSections.push({
        title: 'Abonnements marchands',
        headers,
        rows,
        summary: [
          { label: 'Revenu abonnements', value: `${total.toLocaleString('fr-FR')} FCFA` },
          { label: 'Nombre',             value: rows.length.toLocaleString('fr-FR') },
        ],
      })
    }
  }

  // ── Génération de la réponse ────────────────────────────────────────────────
  const slug = `greenflame_export_${from}_${to}`

  if (format === 'csv') {
    const combined = csvParts.join('')
    return csvResponse('﻿' + combined.replace('﻿', ''), `${slug}.csv`)
  }

  if (!pdfSections.length) {
    return NextResponse.json({ error: 'Aucune donnée à exporter' }, { status: 404 })
  }

  const pdfBuffer = await renderToBuffer(
    createElement(AdminExportPdf, {
      sections: pdfSections,
      from,
      to,
      generatedAt,
    }) as ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
      'Cache-Control':       'no-store',
    },
  })
}
