'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'
import { normalizePhone } from '@/lib/utils/phone'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PhoneInput from '@/components/ui/PhoneInput'

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
  const supabase = createClient()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showEnroll, setShowEnroll] = useState(false)
  const [categories, setCategories] = useState<Array<{ code: string; name_fr: string; commission_rate: number }>>([])

  // Form etat pour enrolement
  const [form, setForm] = useState({
    phone: '',
    businessName: '',
    category: '',
    address: '',
  })
  const [enrollLoading, setEnrollLoading] = useState(false)

  useEffect(() => {
    loadMerchants()
    loadCategories()
  }, [])

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
          <p className="text-gray-400 text-sm mt-1">{merchants.length} marchand(s) enregistré(s)</p>
        </div>
        <button
          onClick={() => setShowEnroll(true)}
          className="bg-brand-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-700 transition-colors"
        >
          + Enroler un marchand
        </button>
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
            ) : (
              filtered.map(m => {
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
                      {/* Badge support prioritaire VIP */}
                      {isVipActive && (
                        <span className="flex-shrink-0 text-[10px] bg-amber-900 text-amber-300 font-bold px-1.5 py-0.5 rounded-full">
                          👑 VIP
                        </span>
                      )}
                      {isProActive && !isVipActive && (
                        <span className="flex-shrink-0 text-[10px] bg-brand-900 text-brand-300 font-bold px-1.5 py-0.5 rounded-full">
                          🚀 Pro
                        </span>
                      )}
                      {m.agent_service_active && (
                        <span className="flex-shrink-0 text-[10px] bg-blue-900 text-blue-300 font-bold px-1.5 py-0.5 rounded-full">
                          🏦 Agent
                        </span>
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
