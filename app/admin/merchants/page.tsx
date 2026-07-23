'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'
import { normalizePhone } from '@/lib/utils/phone'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PhoneInput from '@/components/ui/PhoneInput'

type TabType = 'marchands' | 'demandes'
type AppStatus = 'pending_review' | 'assigned' | 'field_verified' | 'pending_admin' | 'approved' | 'rejected'

interface Application {
  id: string
  status: AppStatus
  business_name: string
  business_category: string
  address_text: string
  city: string | null
  ifu: string | null
  created_at: string
  assigned_at: string | null
  visit_done_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  applicant: { full_name: string; phone: string } | null
  agent: { full_name: string } | null
}

const STATUS_CFG: Record<AppStatus, { label: string; color: string }> = {
  pending_review: { label: 'En attente',       color: 'text-gray-400 bg-gray-700' },
  assigned:       { label: 'Agent assigné',     color: 'text-blue-400 bg-blue-900/40' },
  field_verified: { label: 'Terrain validé',    color: 'text-amber-400 bg-amber-900/40' },
  pending_admin:  { label: 'Validation finale', color: 'text-orange-400 bg-orange-900/40' },
  approved:       { label: 'Approuvé',          color: 'text-green-400 bg-green-900/40' },
  rejected:       { label: 'Rejeté',            color: 'text-red-400 bg-red-900/40' },
}

interface Merchant {
  id: string
  business_name: string
  business_category: string
  commission_rate: number
  is_active: boolean
  is_verified: boolean
  total_gmv: number
  created_at: string
  subscription_tier: string
  subscription_expires_at: string | null
  agent_service_active: boolean
  public_slug: string | null
  users: { full_name: string; phone: string } | null
}

export default function AdminMerchantsPage() {
  const supabase      = createClient()
  const searchParams  = useSearchParams()
  const [tab, setTab] = useState<TabType>((searchParams.get('tab') as TabType) ?? 'marchands')

  const [merchants, setMerchants]       = useState<Merchant[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading]           = useState(true)
  const [appsLoading, setAppsLoading]   = useState(true)
  const [search, setSearch]             = useState('')
  const [appSearch, setAppSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all')
  const [showEnroll, setShowEnroll]     = useState(false)
  const [categories, setCategories]     = useState<Array<{ code: string; name_fr: string; commission_rate: number }>>([])

  const [form, setForm] = useState({ phone: '', businessName: '', category: '', address: '' })
  const [enrollLoading, setEnrollLoading] = useState(false)

  const loadApplications = useCallback(async () => {
    setAppsLoading(true)
    const res  = await fetch('/api/admin/merchant-applications')
    const data = res.ok ? await res.json() : []
    setApplications(data as Application[])
    setAppsLoading(false)
  }, [])

  useEffect(() => {
    loadMerchants()
    loadCategories()
    loadApplications()
  }, [loadApplications])

  async function loadMerchants() {
    const res = await fetch('/api/admin/merchants')
    const data = res.ok ? await res.json() : []
    setMerchants(data as Merchant[])
    setLoading(false)
  }

  async function loadCategories() {
    const { data } = await supabase.from('merchant_categories').select('*').order('name_fr')
    setCategories(data ?? [])
  }

  async function toggleActive(merchantId: string, current: boolean) {
    const res = await fetch('/api/admin/toggle-merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, isActive: !current }),
    })
    if (!res.ok) { toast.error('Erreur'); return }
    toast.success(current ? 'Marchand désactivé' : 'Marchand activé')
    loadMerchants()
  }

  async function enrollMerchant(e: React.FormEvent) {
    e.preventDefault()
    setEnrollLoading(true)

    // Chercher l'utilisateur par téléphone
    const phoneNorm = normalizePhone(form.phone)
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phoneNorm)
      .single()

    if (!targetUser) {
      toast.error(`Aucun compte GreenFlame pour le ${form.phone}`)
      setEnrollLoading(false)
      return
    }

    const res = await fetch('/api/merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: targetUser.id,
        businessName: form.businessName,
        businessCategory: form.category,
        addressText: form.address,
      }),
    })

    const data = await res.json()
    setEnrollLoading(false)

    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }

    toast.success('Marchand enrôlé avec succès !')
    setShowEnroll(false)
    setForm({ phone: '', businessName: '', category: '', address: '' })
    loadMerchants()
  }

  const filtered = merchants.filter(m =>
    m.business_name.toLowerCase().includes(search.toLowerCase()) ||
    m.users?.phone.includes(search)
  )

  const filteredApps = applications.filter(a => {
    const matchSearch = !appSearch ||
      a.business_name.toLowerCase().includes(appSearch.toLowerCase()) ||
      a.applicant?.full_name.toLowerCase().includes(appSearch.toLowerCase()) ||
      a.applicant?.phone.includes(appSearch)
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendingCount = applications.filter(a => !['approved', 'rejected'].includes(a.status)).length

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Marchands</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marchands</h1>
          <p className="text-gray-400 text-sm mt-1">{merchants.length} actif(s) · {applications.length} demande(s)</p>
        </div>
        <button
          onClick={() => setShowEnroll(true)}
          className="bg-brand-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-700 transition-colors"
        >
          + Enrôler un marchand
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit">
        <TabBtn active={tab === 'marchands'} onClick={() => setTab('marchands')}>
          Marchands actifs <span className="ml-1.5 text-xs bg-gray-700 px-1.5 py-0.5 rounded-full">{merchants.length}</span>
        </TabBtn>
        <TabBtn active={tab === 'demandes'} onClick={() => setTab('demandes')}>
          Demandes
          {pendingCount > 0 && (
            <span className="ml-1.5 text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </TabBtn>
      </div>

      {/* Enrolement modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-xl text-white mb-4">Enrôler un marchand</h2>
            <form onSubmit={enrollMerchant} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm block mb-1">Téléphone du propriétaire</label>
                <PhoneInput
                  value={form.phone}
                  onChange={v => setForm(f => ({ ...f, phone: v }))}
                  placeholder="97 00 00 00"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-1">Nom du commerce</label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  placeholder="Ex: Epicerie Kouassi"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-1">Catégorie</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {categories.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.name_fr} ({(c.commission_rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}%)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-1">Adresse (optionnel)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Ex: Marche Dantokpa, Stand B12"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={enrollLoading} className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-medium">
                  {enrollLoading ? 'Enrôlement...' : 'Enrôler'}
                </button>
                <button type="button" onClick={() => setShowEnroll(false)} className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ONGLET DEMANDES ─────────────────────────────────────── */}
      {tab === 'demandes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={appSearch}
              onChange={e => setAppSearch(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 min-w-48 bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-brand-500 focus:outline-none text-sm"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as AppStatus | 'all')}
              className="bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-brand-500 focus:outline-none text-sm"
            >
              <option value="all">Tous les statuts</option>
              {(Object.keys(STATUS_CFG) as AppStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_CFG[s].label}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-800 rounded-xl overflow-x-auto">
            <table className="min-w-full w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  {['Demandeur', 'Boutique', 'Statut', 'Agent terrain', 'Soumis le', 'Visite', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {appsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
                ) : filteredApps.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune demande</td></tr>
                ) : filteredApps.map(a => {
                  const cfg = STATUS_CFG[a.status]
                  return (
                    <tr key={a.id} className="hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm text-white font-medium">{a.applicant?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{a.applicant?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-200">{a.business_name}</p>
                        <p className="text-xs text-gray-500">{a.business_category} · {a.city ?? a.address_text}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {a.agent?.full_name ?? <span className="text-gray-600">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(a.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {a.visit_done_at ? fmtDate(a.visit_done_at) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/merchants/applications/${a.id}`}
                          className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET MARCHANDS ────────────────────────────────────── */}
      {tab === 'marchands' && (
        <div className="space-y-4">
          {/* Recherche */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un marchand..."
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-500 focus:outline-none"
          />

          {/* Table */}
          <div className="bg-gray-800 rounded-xl overflow-x-auto">
            <table className="min-w-full w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  {['Commerce', 'Catégorie', 'Commission', 'GMV total', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chargement...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun marchand</td></tr>
                ) : filtered.map(m => {
                  const now = new Date()
                  const isVipActive = m.subscription_tier === 'vip'
                    && m.subscription_expires_at
                    && new Date(m.subscription_expires_at) > now
                  const isProActive = m.subscription_tier === 'pro'
                    && m.subscription_expires_at
                    && new Date(m.subscription_expires_at) > now
                  return (
                    <tr key={m.id} className={`hover:bg-gray-900/40 transition-colors ${isVipActive ? 'border-l-2 border-amber-500' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div>
                            <Link href={`/admin/merchants/${m.id}`} className="font-medium text-brand-400 hover:text-brand-300 hover:underline block">
                              {m.business_name}
                            </Link>
                            <p className="text-xs text-gray-400">{m.users?.phone}</p>
                            {m.public_slug && (
                              <p className="text-xs text-gray-500">/boutique/{m.public_slug}</p>
                            )}
                          </div>
                          {isVipActive && (
                            <span className="flex-shrink-0 text-[10px] bg-amber-900 text-amber-300 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
                          )}
                          {isProActive && !isVipActive && (
                            <span className="flex-shrink-0 text-[10px] bg-brand-900 text-brand-300 font-bold px-1.5 py-0.5 rounded-full">Pro</span>
                          )}
                          {m.agent_service_active && (
                            <span className="flex-shrink-0 text-[10px] bg-blue-900 text-blue-300 font-bold px-1.5 py-0.5 rounded-full">Agent</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{m.business_category}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{(m.commission_rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}%</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{formatFcfa(m.total_gmv)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${m.is_active ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'}`}>
                          {m.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(m.id, m.is_active)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {m.is_active ? 'Desactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
