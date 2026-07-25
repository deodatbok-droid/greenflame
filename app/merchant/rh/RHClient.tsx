'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Employee = {
  id: string
  full_name: string
  role: string | null
  phone: string | null
  pay_type: 'daily' | 'weekly' | 'monthly' | 'task'
  base_amount: number | null
  status: 'active' | 'inactive'
  is_formal: boolean
  solde: number
  gagné: number
  avances: number
  payé: number
}

const PAY_TYPE_LABELS: Record<string, string> = {
  daily:   'À la journée',
  weekly:  'À la semaine',
  monthly: 'Au mois',
  task:    'À la prestation',
}

function fmtFcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

export default function RHClient() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [filter, setFilter]       = useState<'all' | 'active' | 'inactive'>('active')

  // Formulaire création
  const [fName, setFName]         = useState('')
  const [fRole, setFRole]         = useState('')
  const [fPhone, setFPhone]       = useState('')
  const [fPayType, setFPayType]   = useState<'daily' | 'weekly' | 'monthly' | 'task'>('daily')
  const [fBase, setFBase]         = useState('')
  const [fFormal, setFFormal]     = useState(false)
  const [fCnss, setFCnss]         = useState('')
  const [fContract, setFContract] = useState('')
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/merchant/rh/employees')
      if (res.ok) setEmployees(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!fName.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/merchant/rh/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:     fName.trim(),
          role:          fRole.trim() || null,
          phone:         fPhone.trim() || null,
          pay_type:      fPayType,
          base_amount:   fBase ? Number(fBase.replace(/\D/g, '')) : null,
          is_formal:     fFormal,
          cnss_number:   fCnss.trim() || null,
          contract_type: fContract || null,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Employé ajouté')
      setShowForm(false)
      setFName(''); setFRole(''); setFPhone(''); setFBase('')
      setFFormal(false); setFCnss(''); setFContract('')
      load()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const filtered = employees.filter(e =>
    filter === 'all' ? true : e.status === filter
  )

  const totalSoldes    = employees.filter(e => e.status === 'active').reduce((s, e) => s + Math.max(0, e.solde), 0)
  const activeCount    = employees.filter(e => e.status === 'active').length
  const dettesCount    = employees.filter(e => e.solde > 0).length

  return (
    <div className="space-y-6 pb-10 max-w-2xl mx-auto px-4 pt-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ressources humaines</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi de votre personnel</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors"
        >
          + Employé
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
          <div className="text-xs text-gray-500 mt-1">Actifs</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-lg font-bold text-amber-600">{fmtFcfa(totalSoldes)}</div>
          <div className="text-xs text-gray-500 mt-1">À payer</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-brand-600">{dettesCount}</div>
          <div className="text-xs text-gray-500 mt-1">En attente</div>
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-brand-200 p-5 space-y-4">
          <p className="font-semibold text-gray-900">Nouvel employé</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Nom complet *</label>
              <input value={fName} onChange={e => setFName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="Koffi Atchadé" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Poste / Rôle</label>
              <input value={fRole} onChange={e => setFRole(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="Vendeur, livreur…" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <input value={fPhone} onChange={e => setFPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="+229…" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mode de paiement</label>
              <select value={fPayType} onChange={e => setFPayType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                {Object.entries(PAY_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Montant de base (FCFA)
                <span className="text-gray-400 ml-1 font-normal">
                  {fPayType === 'daily' ? '/ jour' : fPayType === 'weekly' ? '/ sem.' : fPayType === 'monthly' ? '/ mois' : '/ prestation'}
                </span>
              </label>
              <input value={fBase} onChange={e => setFBase(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="5000" inputMode="numeric" />
            </div>
          </div>

          {/* Toggle couche formelle */}
          <div>
            <button
              type="button"
              onClick={() => setFFormal(f => !f)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                fFormal ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                fFormal ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-400'
              }`}>{fFormal ? '✓' : ''}</span>
              Employé avec contrat formel (CNSS, CDD/CDI…)
            </button>
          </div>

          {fFormal && (
            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">N° CNSS</label>
                <input value={fCnss} onChange={e => setFCnss(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="Optionnel" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type de contrat</label>
                <select value={fContract} onChange={e => setFContract(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                  <option value="">— Choisir —</option>
                  <option value="cdi">CDI</option>
                  <option value="cdd">CDD</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtre */}
      <div className="flex gap-2">
        {(['active', 'all', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {f === 'active' ? 'Actifs' : f === 'all' ? 'Tous' : 'Inactifs'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <div className="text-4xl mb-2">👥</div>
          <p className="font-medium text-gray-700">Aucun employé</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez votre premier employé en haut de la page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => (
            <Link key={emp.id} href={`/merchant/rh/${emp.id}`}
              className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-base font-bold text-brand-700 flex-shrink-0">
                    {emp.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{emp.full_name}</p>
                      {emp.is_formal && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          Formel
                        </span>
                      )}
                      {emp.status === 'inactive' && (
                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {emp.role ? `${emp.role} · ` : ''}{PAY_TYPE_LABELS[emp.pay_type]}
                      {emp.base_amount ? ` · ${fmtFcfa(emp.base_amount)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${emp.solde > 0 ? 'text-amber-600' : emp.solde < 0 ? 'text-gray-400' : 'text-green-600'}`}>
                    {emp.solde > 0 ? `À payer ${fmtFcfa(emp.solde)}` : emp.solde < 0 ? `Avancé ${fmtFcfa(-emp.solde)}` : 'À jour'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Voir détail →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
