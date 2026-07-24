/**
 * lib/exports/pdf-templates.tsx
 * Composants React PDF pour GreenFlame (@react-pdf/renderer)
 * Utilisés uniquement côté serveur (API routes).
 */

import React from 'react'
import {
  Document, Page, View, Text, StyleSheet, Font,
} from '@react-pdf/renderer'

// ── Couleurs GreenFlame ────────────────────────────────────────────────────────
const GF = {
  green:      '#16a34a',
  greenLight: '#dcfce7',
  greenDark:  '#14532d',
  gray50:     '#f9fafb',
  gray100:    '#f3f4f6',
  gray200:    '#e5e7eb',
  gray400:    '#9ca3af',
  gray600:    '#4b5563',
  gray700:    '#374151',
  gray900:    '#111827',
  amber:      '#d97706',
  red:        '#dc2626',
  white:      '#ffffff',
}

// ── Styles partagés ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:          { backgroundColor: GF.white, fontFamily: 'Helvetica', fontSize: 10, color: GF.gray700, paddingBottom: 50 },
  header:        { backgroundColor: GF.green, paddingVertical: 20, paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLogo:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: GF.white },
  headerSub:     { fontSize: 9, color: '#bbf7d0', marginTop: 2 },
  headerRight:   { alignItems: 'flex-end' },
  headerTitle:   { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GF.white },
  headerPeriod:  { fontSize: 9, color: '#bbf7d0', marginTop: 3 },

  body:          { paddingHorizontal: 32, paddingTop: 20 },
  section:       { marginBottom: 18 },
  sectionTitle:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GF.gray900, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: GF.gray200 },

  kpiRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard:       { flex: 1, backgroundColor: GF.gray50, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: GF.gray200 },
  kpiLabel:      { fontSize: 8, color: GF.gray400, marginBottom: 3 },
  kpiValue:      { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GF.gray900 },
  kpiUnit:       { fontSize: 8, color: GF.gray400 },

  table:         { width: '100%' },
  tableHead:     { flexDirection: 'row', backgroundColor: GF.green, borderRadius: 4 },
  tableHeadCell: { flex: 1, padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: GF.white },
  tableRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GF.gray100 },
  tableRowAlt:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GF.gray100, backgroundColor: GF.gray50 },
  tableCell:     { flex: 1, padding: 5, fontSize: 8.5, color: GF.gray700 },
  tableCellBold: { flex: 1, padding: 5, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: GF.gray900 },

  bullet:        { flexDirection: 'row', marginBottom: 5, gap: 6 },
  bulletDot:     { fontSize: 10, color: GF.green, marginTop: -1 },
  bulletText:    { flex: 1, fontSize: 9.5, color: GF.gray700, lineHeight: 1.4 },

  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 10 },
  summaryBox:    { backgroundColor: GF.gray50, borderRadius: 6, padding: 12, borderLeftWidth: 3, borderLeftColor: GF.green, marginBottom: 14 },
  summaryText:   { fontSize: 10, color: GF.gray700, lineHeight: 1.5 },

  footer:        { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: GF.gray200, paddingTop: 6 },
  footerText:    { fontSize: 7.5, color: GF.gray400 },
})

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('fr-FR')
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const METHOD_LABELS: Record<string, string> = {
  momo: 'MTN MoMo', moov: 'Moov Money', cash: 'Espèces',
  wallet: 'Portefeuille GF', orange: 'Orange Money', autre: 'Autre',
}

// ── Composant Header ───────────────────────────────────────────────────────────
function PdfHeader({ title, subtitle, merchantName }: { title: string; subtitle: string; merchantName?: string }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerLogo}>🌿 GreenFlame</Text>
        {merchantName && <Text style={s.headerSub}>{merchantName}</Text>}
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerTitle}>{title}</Text>
        <Text style={s.headerPeriod}>{subtitle}</Text>
      </View>
    </View>
  )
}

// ── Composant Footer ───────────────────────────────────────────────────────────
function PdfFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>GreenFlame · Document confidentiel</Text>
      <Text style={s.footerText}>Généré le {fmtDateTime(generatedAt)}</Text>
    </View>
  )
}

// ── RAPPORT COMPTABLE MARCHAND ─────────────────────────────────────────────────

type TxRow = {
  id:               string
  created_at:       string
  amount_fcfa:      number
  commission_total: number
  payment_method:   string | null
  buyers?:          { full_name: string } | null
}

interface ComptablePdfProps {
  merchantName: string
  periodLabel:  string
  from:         string
  to:           string
  txs:          TxRow[]
  generatedAt:  string
}

export function MerchantComptablePdf({ merchantName, periodLabel, from, to, txs, generatedAt }: ComptablePdfProps) {
  const totalGmv  = txs.reduce((s, t) => s + t.amount_fcfa, 0)
  const totalComm = txs.reduce((s, t) => s + t.commission_total, 0)
  const totalNet  = totalGmv - totalComm

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PdfHeader
          title="Relevé de transactions"
          subtitle={`${periodLabel}  ·  Du ${fmtDate(from)} au ${fmtDate(to)}`}
          merchantName={merchantName}
        />

        <View style={s.body}>
          {/* KPIs */}
          <View style={s.kpiRow}>
            {[
              { label: 'Chiffre d\'affaires', value: fmt(totalGmv), unit: 'FCFA' },
              { label: 'Revenu net',           value: fmt(totalNet),  unit: 'FCFA' },
              { label: 'Commissions GF',       value: fmt(totalComm), unit: 'FCFA' },
              { label: 'Nombre de ventes',     value: String(txs.length), unit: 'transactions' },
            ].map(k => (
              <View key={k.label} style={s.kpiCard}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value} <Text style={s.kpiUnit}>{k.unit}</Text></Text>
              </View>
            ))}
          </View>

          {/* Tableau */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Détail des transactions</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                {['Date', 'Heure', 'Client', 'Montant (FCFA)', 'Commission (FCFA)', 'Net reçu (FCFA)', 'Mode de paiement'].map(h => (
                  <Text key={h} style={[s.tableHeadCell, h === 'Client' ? { flex: 2 } : {}]}>{h}</Text>
                ))}
              </View>
              {txs.map((tx, i) => (
                <View key={tx.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={s.tableCell}>{fmtDate(tx.created_at)}</Text>
                  <Text style={s.tableCell}>{new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={[s.tableCell, { flex: 2 }]}>{tx.buyers?.full_name ?? 'Client'}</Text>
                  <Text style={s.tableCellBold}>{fmt(tx.amount_fcfa)}</Text>
                  <Text style={s.tableCell}>{fmt(tx.commission_total)}</Text>
                  <Text style={[s.tableCellBold, { color: GF.green }]}>{fmt(tx.amount_fcfa - tx.commission_total)}</Text>
                  <Text style={s.tableCell}>{METHOD_LABELS[tx.payment_method ?? 'autre'] ?? tx.payment_method ?? '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PdfFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  )
}

// ── RAPPORT ANALYTIQUE IA MARCHAND ─────────────────────────────────────────────

interface ReportIaPdfProps {
  merchantName:    string
  periodLabel:     string
  generatedAt:     string
  summary:         string
  highlights:      string[]
  improvements:    string[]
  recommendations: string[]
  risk_level:      'normal' | 'attention' | 'alert'
  metrics:         {
    gmv: number; net: number; txCount: number; avgBasket: number
    uniqueBuyers: number; newBuyers: number; returningBuyers: number; retentionRate: number
    bestDow: string; bestHour: string
  }
}

export function MerchantReportIaPdf({
  merchantName, periodLabel, generatedAt, summary,
  highlights, improvements, recommendations, risk_level, metrics,
}: ReportIaPdfProps) {
  const riskConfig = {
    normal:    { bg: '#f0fdf4', color: '#166534', label: 'Activité normale ✅' },
    attention: { bg: '#fefce8', color: '#854d0e', label: 'Points à surveiller ⚠️' },
    alert:     { bg: '#fef2f2', color: '#991b1b', label: 'Attention requise 🚨' },
  }
  const rc = riskConfig[risk_level]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          title="Rapport d'activité"
          subtitle={`Analyse IA · ${periodLabel}`}
          merchantName={merchantName}
        />

        <View style={s.body}>
          {/* Badge risk */}
          <View style={[s.badge, { backgroundColor: rc.bg }]}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: rc.color }}>{rc.label}</Text>
          </View>

          {/* Résumé */}
          <View style={[s.summaryBox, { borderLeftColor: risk_level === 'normal' ? GF.green : risk_level === 'attention' ? '#d97706' : GF.red }]}>
            <Text style={s.summaryText}>{summary}</Text>
          </View>

          {/* KPIs clés */}
          <View style={s.kpiRow}>
            {[
              { label: 'Chiffre d\'affaires',  value: fmt(metrics.gmv),          unit: 'FCFA' },
              { label: 'Revenu net',            value: fmt(metrics.net),          unit: 'FCFA' },
              { label: 'Ventes',                value: String(metrics.txCount),   unit: 'transactions' },
              { label: 'Panier moyen',          value: fmt(metrics.avgBasket),    unit: 'FCFA' },
            ].map(k => (
              <View key={k.label} style={s.kpiCard}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value} <Text style={s.kpiUnit}>{k.unit}</Text></Text>
              </View>
            ))}
          </View>
          <View style={[s.kpiRow, { marginTop: -10 }]}>
            {[
              { label: 'Clients uniques',      value: String(metrics.uniqueBuyers),    unit: 'clients' },
              { label: 'Nouveaux clients',      value: String(metrics.newBuyers),       unit: 'nouveaux' },
              { label: 'Clients fidèles',       value: String(metrics.returningBuyers), unit: `(${metrics.retentionRate}% de fidélité)` },
              { label: 'Meilleur moment',       value: metrics.bestDow,                 unit: `· ${metrics.bestHour}` },
            ].map(k => (
              <View key={k.label} style={s.kpiCard}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value} <Text style={s.kpiUnit}>{k.unit}</Text></Text>
              </View>
            ))}
          </View>

          {/* Points forts */}
          {highlights.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>✅ Points forts</Text>
              {highlights.map((h, i) => (
                <View key={i} style={s.bullet}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Axes d'amélioration */}
          {improvements.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>💡 Axes d'amélioration</Text>
              {improvements.map((imp, i) => (
                <View key={i} style={s.bullet}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{imp}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommandations */}
          {recommendations.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🎯 Recommandations pour le prochain mois</Text>
              {recommendations.map((r, i) => (
                <View key={i} style={[s.bullet, { backgroundColor: GF.greenLight, padding: 6, borderRadius: 4, marginBottom: 6 }]}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: GF.greenDark, marginRight: 4 }}>{i + 1}.</Text>
                  <Text style={[s.bulletText, { color: GF.greenDark }]}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <PdfFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  )
}

// ── EXPORT ADMIN MULTI-DATASET ─────────────────────────────────────────────────

export interface AdminExportSection {
  title:   string
  headers: string[]
  rows:    (string | number | null)[][]
  summary?: { label: string; value: string }[]
}

interface AdminExportPdfProps {
  sections:    AdminExportSection[]
  from:        string
  to:          string
  generatedAt: string
}

export function AdminExportPdf({ sections, from, to, generatedAt }: AdminExportPdfProps) {
  return (
    <Document>
      {sections.map((section, si) => (
        <Page key={si} size="A4" orientation="landscape" style={s.page}>
          <PdfHeader
            title={section.title}
            subtitle={`Du ${fmtDate(from)} au ${fmtDate(to)}`}
          />

          <View style={s.body}>
            {/* Summary KPIs si présents */}
            {section.summary && section.summary.length > 0 && (
              <View style={[s.kpiRow, { marginBottom: 14 }]}>
                {section.summary.map(k => (
                  <View key={k.label} style={s.kpiCard}>
                    <Text style={s.kpiLabel}>{k.label}</Text>
                    <Text style={[s.kpiValue, { fontSize: 12 }]}>{k.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Tableau */}
            <View style={s.table}>
              <View style={s.tableHead}>
                {section.headers.map(h => (
                  <Text key={h} style={s.tableHeadCell}>{h}</Text>
                ))}
              </View>
              {section.rows.slice(0, 500).map((row, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  {row.map((cell, j) => (
                    <Text key={j} style={s.tableCell}>{cell === null || cell === undefined ? '' : String(cell)}</Text>
                  ))}
                </View>
              ))}
              {section.rows.length > 500 && (
                <View style={[s.tableRow, { backgroundColor: '#fef9c3' }]}>
                  <Text style={[s.tableCell, { color: '#854d0e', fontFamily: 'Helvetica-Bold' }]}>
                    … {section.rows.length - 500} lignes supplémentaires — utiliser l&apos;export CSV pour le dataset complet.
                  </Text>
                </View>
              )}
            </View>
          </View>

          <PdfFooter generatedAt={generatedAt} />
        </Page>
      ))}
    </Document>
  )
}
