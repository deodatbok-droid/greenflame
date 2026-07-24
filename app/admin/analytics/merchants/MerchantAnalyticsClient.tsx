'use client'

/**
 * MerchantAnalyticsClient — Dashboard analytics interactif
 *
 * Props :
 *   kpis              — Métriques globales
 *   sectorAnalytics   — Par secteur (vue v_sector_analytics)
 *   challengesAnalytics — Défis terrain (vue v_challenges_analytics)
 *   merchants         — Liste marchands avec onboarding
 */

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────

type KPIs = {
  totalMerchants: number
  proMerchants: number
  activatedSector: number
  totalOnboarding: number
  activationRate: number
}

type SectorRow = {
  sector: string
  total_responses: number
  activated_count: number
  activation_rate_pct: number
  b2c_count: number
  b2b_count: number
  mixed_count: number
  most_common_basket: string
  most_common_volume: string
  most_common_seniority: string
  first_response_at: string
  last_response_at: string
}

type ChallengeRow = {
  challenge: string
  mention_count: number
  pct_of_merchants: number
}

type Merchant = {
  id: string
  business_name: string | null
  subscription_tier: string | null
  sector: string | null
  sector_activated_at: string | Date | null
  created_at: string | Date
  user: { email: string | null; name: string | null }
  onboarding_response: {
    client_type: string
    avg_basket: string
    monthly_volume: string
    main_challenges: string[]
    seniority: string
    tool_activated: boolean
  } | null
}

// ─── Libellés ─────────────────────────────────────────────────────

const SECTOR_LABELS: Record<string, string> = {
  consultant: 'Consultant',
  avocat: 'Avocat',
  photographe: 'Photographe',
  transporteur: 'Transport',
  medecin: 'Médecin',
  coach: 'Coach',
  evenement: 'Événementiel',
  imprimerie: 'Imprimerie',
  autre: 'Autre',
}

const SECTOR_ICONS: Record<string, string> = {
  consultant: '💼', avocat: '⚖️', photographe: '📸', transporteur: '🚛',
  medecin: '🏥', coach: '🎯', evenement: '🎉', imprimerie: '🖨️', autre: '✨',
}

const CHALLENGE_LABELS: Record<string, string> = {
  clients: 'Trouver des clients',
  compta: 'Gérer la comptabilité',
  paiement: 'Se faire payer',
  fidelisation: 'Fidéliser',
  temps: 'Gérer son temps',
  image: 'Professionnaliser son image',
}

const BASKET_LABELS: Record<string, string> = {
  '<10k': '<10k FCFA', '10k-50k': '10k–50k', '50k-200k': '50k–200k', '>200k': '>200k',
}

const VOLUME_LABELS: Record<string, string> = {
  '<10': '<10/mois', '10-30': '10–30', '30-100': '30–100', '>100': '>100',
}

const TIER_COLORS: Record<string, string> = {
  pro: 'bg-blue-100 text-blue-700',
  vip: 'bg-amber-100 text-amber-700',
  free: 'bg-gray-100 text-gray-600',
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProgressBar({ pct, color = 'bg-brand-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full w-full">
      <div className={`h-1.5 ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────

export default function MerchantAnalyticsClient({
  kpis,
  sectorAnalytics,
  challengesAnalytics,
  merchants,
}: {
  kpis: KPIs
  sectorAnalytics: SectorRow[]
  challengesAnalytics: ChallengeRow[]
  merchants: Merchant[]
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'sectors' | 'merchants'>('overview')
  const [sectorFilter, setSectorFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const filteredMerchants = merchants.filter(m => {
    const matchSector = !sectorFilter || m.sector === sectorFilter
    const matchSearch = !search ||
      m.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email?.toLowerCase().includes(search.toLowerCase())
    return matchSector && matchSearch
  })

  const tabs = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'sectors',  label: 'Par secteur' },
    { key: 'merchants', label: 'Marchands' },
  ] as const

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/admin/merchants" className="text-gray-400 hover:text-gray-600 text-sm">Marchands</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-400 text-sm">Analytics</span>
      </div>

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Marchands</h1>
        <p className="text-gray-400 text-sm mt-1">
          Onboarding sectoriel · Données collectées via le questionnaire de personnalisation
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1 : Vue d'ensemble ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Marchands totaux',         value: kpis.totalMerchants,   color: 'text-gray-900' },
              { label: 'Marchands Pro',             value: kpis.proMerchants,     color: 'text-blue-600' },
              { label: 'Outil sectoriel activé',   value: kpis.activatedSector,  color: 'text-green-600' },
              { label: 'Questionnaires remplis',   value: kpis.totalOnboarding,  color: 'text-amber-600' },
              { label: 'Taux d\'activation Pro →', value: `${kpis.activationRate}%`, color: 'text-brand-600' },
            ].map(kpi => (
              <div key={kpi.label} className="card text-center">
                <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Défis terrain */}
          <div className="card">
            <h2 className="text-base font-bold text-gray-900 mb-4">Défis terrain — ce que vivent vos marchands</h2>
            <div className="space-y-3">
              {challengesAnalytics.slice(0, 6).map((row, i) => (
                <div key={row.challenge} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                    {CHALLENGE_LABELS[row.challenge] ?? row.challenge}
                  </span>
                  <div className="flex-1 max-w-32">
                    <ProgressBar pct={row.pct_of_merchants} />
                  </div>
                  <span className="text-xs font-semibold text-gray-900 w-12 text-right">
                    {row.pct_of_merchants}%
                  </span>
                  <span className="text-xs text-gray-400 w-20 text-right">
                    {row.mention_count} marchands
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini-résumé secteurs */}
          <div className="card">
            <h2 className="text-base font-bold text-gray-900 mb-4">Répartition par secteur</h2>
            <div className="space-y-2">
              {sectorAnalytics.slice(0, 8).map(row => (
                <div key={row.sector} className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">{SECTOR_ICONS[row.sector] ?? '✨'}</span>
                  <span className="text-sm text-gray-700 flex-1 min-w-0">
                    {SECTOR_LABELS[row.sector] ?? row.sector}
                  </span>
                  <div className="flex-1 max-w-40">
                    <ProgressBar
                      pct={sectorAnalytics[0]?.total_responses
                        ? (row.total_responses / sectorAnalytics[0].total_responses) * 100
                        : 0}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-8 text-right">{row.total_responses}</span>
                  <span className="text-xs text-green-600 w-12 text-right">{row.activation_rate_pct}% actif</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2 : Par secteur ────────────────────────────────────── */}
      {activeTab === 'sectors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sectorAnalytics.map(row => (
            <div key={row.sector} className="card space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{SECTOR_ICONS[row.sector] ?? '✨'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{SECTOR_LABELS[row.sector] ?? row.sector}</p>
                  <p className="text-xs text-gray-400">{row.total_responses} réponses · {row.activated_count} activés</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">{row.activation_rate_pct}%</p>
                  <p className="text-xs text-gray-400">activation</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{row.b2c_count}</p>
                  <p className="text-xs text-gray-400">B2C</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{row.b2b_count}</p>
                  <p className="text-xs text-gray-400">B2B</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{row.mixed_count}</p>
                  <p className="text-xs text-gray-400">Mixte</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Panier modal', value: BASKET_LABELS[row.most_common_basket] ?? row.most_common_basket },
                  { label: 'Volume modal', value: VOLUME_LABELS[row.most_common_volume] ?? row.most_common_volume },
                  { label: 'Ancienneté', value: row.most_common_seniority ?? '—' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{item.value ?? '—'}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-gray-300">
                Premier {fmtDate(row.first_response_at)} · Dernier {fmtDate(row.last_response_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 3 : Tableau marchands ──────────────────────────────── */}
      {activeTab === 'merchants' && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Rechercher par nom ou email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input flex-1 min-w-48 max-w-72"
            />
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">Tous les secteurs</option>
              {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <span className="text-sm text-gray-400 self-center">
              {filteredMerchants.length} marchand{filteredMerchants.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tableau */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Marchand', 'Plan', 'Secteur', 'Client', 'Panier', 'Volume', 'Défis', 'Activé le'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMerchants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                      Aucun marchand trouvé
                    </td>
                  </tr>
                )}
                {filteredMerchants.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {/* Marchand */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 whitespace-nowrap">
                        {m.business_name ?? m.user.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400">{m.user.email}</p>
                    </td>
                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[m.subscription_tier ?? 'free'] ?? 'bg-gray-100 text-gray-600'}`}>
                        {m.subscription_tier ?? 'free'}
                      </span>
                    </td>
                    {/* Secteur */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.sector ? (
                        <span className="flex items-center gap-1.5">
                          <span>{SECTOR_ICONS[m.sector] ?? '✨'}</span>
                          <span className="text-gray-700">{SECTOR_LABELS[m.sector] ?? m.sector}</span>
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Type client */}
                    <td className="px-4 py-3 text-gray-600">
                      {m.onboarding_response?.client_type ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* Panier */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {m.onboarding_response?.avg_basket
                        ? BASKET_LABELS[m.onboarding_response.avg_basket]
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Volume */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {m.onboarding_response?.monthly_volume
                        ? VOLUME_LABELS[m.onboarding_response.monthly_volume]
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Défis */}
                    <td className="px-4 py-3">
                      {m.onboarding_response?.main_challenges?.length
                        ? (
                          <div className="flex flex-wrap gap-1">
                            {m.onboarding_response.main_challenges.map(c => (
                              <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                {CHALLENGE_LABELS[c] ?? c}
                              </span>
                            ))}
                          </div>
                        )
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Date activation */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {m.sector_activated_at
                        ? fmtDate(m.sector_activated_at)
                        : <span className="text-gray-300">Non activé</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
