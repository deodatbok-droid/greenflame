'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Entry = {
  id: string
  type: 'recette' | 'depense'
  amount_fcfa: number
  categorie: string
  libelle: string
  date_entree: string
  created_at: string
}

const CATEGORIES_RECETTE = ['Vente directe', 'Prestation de service', 'Avance client', 'Autre recette']
const CATEGORIES_DEPENSE = ['Loyer / Local', 'Salaire / Aide', 'Achat stock', 'Transport', 'Télécommunications', 'Marketing', 'Matériel / Équipement', 'Taxes / Frais', 'Autre dépense']

function fmtFcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function CaisseClient({ merchantId, businessName }: { merchantId: string; businessName: string }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => getMonthKey(new Date().toISOString()))

  // Formulaire
  const [fType, setFType] = useState<'recette' | 'depense'>('recette')
  const [fAmount, setFAmount] = useState('')
  const [fCat, setFCat] = useState('')
  const [fLibelle, setFLibelle] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('caisse_entries')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('date_entree', { ascending: false })
      .limit(500)
    setEntries((data ?? []) as Entry[])
    setLoading(false)
  }, [merchantId])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!fAmount || !fLibelle) { toast.error('Remplissez tous les champs.'); return }
    const amount = parseInt(fAmount.replace(/\D/g, ''))
    if (!amount || amount <= 0) { toast.error('Montant invalide.'); return }
    setSaving(true)
    const { error } = await supabase.from('caisse_entries').insert({
      merchant_id: merchantId,
      type:        fType,
      amount_fcfa: amount,
      categorie:   fCat || (fType === 'recette' ? 'Autre recette' : 'Autre dépense'),
      libelle:     fLibelle,
      date_entree: fDate,
    })
    if (error) { toast.error('Erreur.'); setSaving(false); return }
    toast.success('Enregistré.')
    setFAmount(''); setFLibelle(''); setFCat(''); setShowForm(false)
    load()
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('caisse_entries').delete().eq('id', id)
    setEntries(e => e.filter(x => x.id !== id))
    toast.success('Supprimée.')
  }

  // Calcul mensuel
  const months = [...new Set(entries.map(e => getMonthKey(e.date_entree)))].sort().reverse()
  const monthEntries = entries.filter(e => getMonthKey(e.date_entree) === viewMonth)
  const recettes  = monthEntries.filter(e => e.type === 'recette').reduce((s, e) => s + e.amount_fcfa, 0)
  const depenses  = monthEntries.filter(e => e.type === 'depense').reduce((s, e) => s + e.amount_fcfa, 0)
  const resultat  = recettes - depenses

  // Agrégation par catégorie pour le mois
  const catMap: Record<string, { recette: number; depense: number }> = {}
  for (const e of monthEntries) {
    if (!catMap[e.categorie]) catMap[e.categorie] = { recette: 0, depense: 0 }
    catMap[e.categorie][e.type] += e.amount_fcfa
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Livre de caisse</h1>
          <p className="text-sm text-gray-500 mt-0.5">{businessName}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {showForm ? '✕ Fermer' : '+ Nouvelle entrée'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Nouvelle opération</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <div className="flex gap-3">
                {(['recette', 'depense'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setFType(t); setFCat('') }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      fType === t
                        ? t === 'recette'
                          ? 'bg-green-50 border-green-400 text-green-700'
                          : 'bg-red-50 border-red-400 text-red-700'
                        : 'bg-gray-50 border-gray-300 text-gray-500'
                    }`}
                  >
                    {t === 'recette' ? '↑ Recette' : '↓ Dépense'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant (FCFA)</label>
              <input
                type="number" min="1" value={fAmount} onChange={e => setFAmount(e.target.value)}
                placeholder="Ex: 25000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
              <select
                value={fCat} onChange={e => setFCat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="">Sélectionner…</option>
                {(fType === 'recette' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Libellé</label>
              <input
                type="text" value={fLibelle} onChange={e => setFLibelle(e.target.value)}
                placeholder="Ex: Achat sacs plastique marché"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={submit} disabled={saving}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Sélecteur de mois + P&L */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
          <select
            value={viewMonth} onChange={e => setViewMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 w-full sm:w-auto"
          >
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* P&L mensuel */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Recettes</div>
          <div className="text-xl font-bold text-green-700">{fmtFcfa(recettes)}</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-xs text-red-600 font-medium mb-1">Dépenses</div>
          <div className="text-xl font-bold text-red-700">{fmtFcfa(depenses)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${resultat >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className={`text-xs font-medium mb-1 ${resultat >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Résultat net</div>
          <div className={`text-xl font-bold ${resultat >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {resultat >= 0 ? '+' : ''}{fmtFcfa(resultat)}
          </div>
        </div>
      </div>

      {/* Répartition par catégorie */}
      {Object.keys(catMap).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="font-medium text-gray-700 mb-3 text-sm">Répartition par catégorie — {monthLabel(viewMonth)}</div>
          <div className="space-y-1">
            {Object.entries(catMap).sort((a, b) => (b[1].recette + b[1].depense) - (a[1].recette + a[1].depense)).map(([cat, vals]) => (
              <div key={cat} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{cat}</span>
                <div className="flex gap-4">
                  {vals.recette > 0 && <span className="text-green-600">+{fmtFcfa(vals.recette)}</span>}
                  {vals.depense > 0 && <span className="text-red-500">−{fmtFcfa(vals.depense)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Journal */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Journal — {monthLabel(viewMonth)}</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement…</div>
        ) : monthEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            Aucune opération ce mois-ci.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Catégorie</th>
                  <th className="text-left px-4 py-3">Libellé</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthEntries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(e.date_entree)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.categorie}</td>
                    <td className="px-4 py-3 text-gray-800">{e.libelle}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${e.type === 'recette' ? 'text-green-600' : 'text-red-500'}`}>
                      {e.type === 'recette' ? '+' : '−'}{fmtFcfa(e.amount_fcfa)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
