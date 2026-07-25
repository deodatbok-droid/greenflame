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
  cnss_number: string | null
  contract_type: string | null
  contract_start: string | null
  contract_end: string | null
  notes: string | null
}

type LedgerEntry = {
  id: string
  type: 'work' | 'advance' | 'payment' | 'bonus' | 'deduction'
  date: string
  amount: number | null
  units: number | null
  note: string | null
  include_cnss: boolean
  cnss_part_employee: number | null
  cnss_part_employer: number | null
}

const TYPE_LABELS: Record<string, { label: string; icon: string; sign: number; color: string }> = {
  work:      { label: 'Travail',   icon: '🔧', sign:  1, color: 'text-green-700'  },
  bonus:     { label: 'Prime',     icon: '⭐', sign:  1, color: 'text-green-700'  },
  advance:   { label: 'Avance',    icon: '💸', sign:  1, color: 'text-amber-600'  },
  payment:   { label: 'Paiement',  icon: '💰', sign: -1, color: 'text-blue-600'   },
  deduction: { label: 'Retenue',   icon: '⬇️', sign: -1, color: 'text-red-600'    },
}

const PAY_TYPE_LABELS: Record<string, string> = {
  daily: 'À la journée', weekly: 'À la semaine', monthly: 'Au mois', task: 'À la prestation',
}

function fmtFcfa(n: number) { return n.toLocaleString('fr-FR') + ' FCFA' }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EmployeeDetailClient({ employeeId }: { employeeId: string }) {
  const [emp, setEmp]           = useState<Employee | null>(null)
  const [ledger, setLedger]     = useState<LedgerEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Formulaire ajout entrée ledger
  const [fType, setFType]     = useState<LedgerEntry['type']>('work')
  const [fDate, setFDate]     = useState(new Date().toISOString().slice(0, 10))
  const [fAmount, setFAmount] = useState('')
  const [fUnits, setFUnits]   = useState('')
  const [fNote, setFNote]     = useState('')
  const [fCnss, setFCnss]     = useState(false)
  const [saving, setSaving]   = useState(false)

  const loadEmployee = useCallback(async () => {
    try {
      const [empRes, ledgerRes] = await Promise.all([
        fetch(`/api/merchant/rh/employees/${employeeId}`),
        fetch(`/api/merchant/rh/employees/${employeeId}/ledger`),
      ])
      if (empRes.ok) setEmp(await empRes.json())
      if (ledgerRes.ok) setLedger(await ledgerRes.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [employeeId])

  useEffect(() => { loadEmployee() }, [loadEmployee])

  // Calcul solde à partir du ledger
  const soldeCalc = ledger.reduce((s, e) => {
    const meta = TYPE_LABELS[e.type]
    return s + meta.sign * (e.amount ?? 0)
  }, 0)

  // Calcul des montants suggérés pour "Travail"
  const suggestedAmount = (() => {
    if (!emp?.base_amount || !fUnits || fType !== 'work') return null
    return Math.round(emp.base_amount * Number(fUnits))
  })()

  async function handleAddEntry() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        type: fType,
        date: fDate,
        note: fNote.trim() || null,
        include_cnss: fCnss,
      }
      if (fType === 'work' && fUnits) {
        body.units = Number(fUnits)
        body.amount = suggestedAmount ?? (fAmount ? Number(fAmount.replace(/\D/g, '')) : null)
      } else {
        body.amount = fAmount ? Number(fAmount.replace(/\D/g, '')) : null
      }
      const res = await fetch(`/api/merchant/rh/employees/${employeeId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Entrée enregistrée')
      setShowForm(false)
      setFAmount(''); setFUnits(''); setFNote(''); setFCnss(false)
      loadEmployee()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  async function toggleStatus() {
    if (!emp) return
    const newStatus = emp.status === 'active' ? 'inactive' : 'active'
    await fetch(`/api/merchant/rh/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setEmp(e => e ? { ...e, status: newStatus } : e)
    toast.success(newStatus === 'active' ? 'Employé réactivé' : 'Employé marqué inactif')
  }

  // PDF simple : reçu de paiement
  function printReceipt() {
    if (!emp) return
    const paid = ledger.filter(e => e.type === 'payment').reduce((s, e) => s + (e.amount ?? 0), 0)
    const html = `<!DOCTYPE html><html><head><title>Reçu ${emp.full_name}</title>
<style>body{font-family:Arial,sans-serif;max-width:400px;margin:40px auto;color:#1a1a1a}
h1{font-size:20px;text-align:center;color:#14532d}
.line{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
.total{font-weight:bold;font-size:16px;margin-top:12px}
.sig{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}
</style></head><body>
<h1>Reçu de paiement</h1>
<div class="line"><span>Employé</span><span>${emp.full_name}</span></div>
${emp.role ? `<div class="line"><span>Poste</span><span>${emp.role}</span></div>` : ''}
<div class="line"><span>Date</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="line total"><span>Montant payé</span><span>${fmtFcfa(paid)}</span></div>
<div class="line"><span>Solde après paiement</span><span>${fmtFcfa(soldeCalc)}</span></div>
<div class="sig">
  <div>Signature employeur :<br/><br/>___________________</div>
  <div>Signature employé :<br/><br/>___________________</div>
</div>
</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }

  if (loading) return <div className="text-center py-20 text-gray-500">Chargement…</div>
  if (!emp)    return (
    <div className="text-center py-20">
      <p className="text-gray-500">Employé introuvable.</p>
      <Link href="/merchant/rh" className="text-brand-600 text-sm mt-2 inline-block">← Retour</Link>
    </div>
  )

  return (
    <div className="space-y-6 pb-10 max-w-2xl mx-auto px-4 pt-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/merchant/rh" className="text-gray-400 hover:text-gray-600 text-xl">←</Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{emp.full_name}</h1>
            {emp.is_formal && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">Formel</span>
            )}
            {emp.status === 'inactive' && (
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactif</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {emp.role ? `${emp.role} · ` : ''}{PAY_TYPE_LABELS[emp.pay_type]}
            {emp.base_amount ? ` · ${fmtFcfa(emp.base_amount)}` : ''}
          </p>
        </div>
      </div>

      {/* Solde */}
      <div className={`rounded-2xl p-5 ${soldeCalc > 0 ? 'bg-amber-50 border border-amber-200' : soldeCalc < 0 ? 'bg-gray-50 border border-gray-200' : 'bg-green-50 border border-green-200'}`}>
        <p className="text-xs text-gray-500 mb-1">Solde actuel</p>
        <p className={`text-3xl font-extrabold ${soldeCalc > 0 ? 'text-amber-600' : soldeCalc < 0 ? 'text-gray-400' : 'text-green-600'}`}>
          {soldeCalc > 0 ? `${fmtFcfa(soldeCalc)} à payer` : soldeCalc < 0 ? `${fmtFcfa(-soldeCalc)} d'avance` : 'À jour'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowForm(s => !s)}
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors">
          + Ajouter une entrée
        </button>
        <button onClick={printReceipt}
          className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          Imprimer reçu
        </button>
        <button onClick={toggleStatus}
          className="border border-gray-200 text-gray-400 text-xs px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          {emp.status === 'active' ? 'Marquer inactif' : 'Réactiver'}
        </button>
      </div>

      {/* Formulaire entrée ledger */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-brand-200 p-5 space-y-4">
          <p className="font-semibold text-gray-900">Nouvelle entrée</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={fType} onChange={e => { setFType(e.target.value as any); setFAmount(''); setFUnits('') }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                <option value="work">🔧 Travail</option>
                <option value="advance">💸 Avance sur salaire</option>
                <option value="payment">💰 Paiement effectué</option>
                <option value="bonus">⭐ Prime / Bonus</option>
                <option value="deduction">⬇️ Retenue</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
            </div>

            {fType === 'work' ? (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {emp.pay_type === 'daily' ? 'Jours travaillés' : emp.pay_type === 'weekly' ? 'Semaines' : emp.pay_type === 'task' ? 'Nb prestations' : 'Unités'}
                  </label>
                  <input value={fUnits} onChange={e => setFUnits(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                    placeholder="1" inputMode="decimal" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Montant FCFA
                    {suggestedAmount !== null && (
                      <span className="text-brand-600 ml-1 cursor-pointer" onClick={() => setFAmount(String(suggestedAmount))}>
                        (→ {fmtFcfa(suggestedAmount)})
                      </span>
                    )}
                  </label>
                  <input value={fAmount} onChange={e => setFAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                    placeholder="Calculé auto ou saisir" inputMode="numeric" />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Montant (FCFA)</label>
                <input value={fAmount} onChange={e => setFAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="Montant" inputMode="numeric" />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
              <input value={fNote} onChange={e => setFNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="Semaine du 14 au 18 juillet…" />
            </div>

            {emp.is_formal && (
              <div className="col-span-2">
                <button type="button" onClick={() => setFCnss(f => !f)}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    fCnss ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${fCnss ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'}`}>
                    {fCnss ? '✓' : ''}
                  </span>
                  Inclure cotisations CNSS (salarié 3,6% / patronal 16,4%)
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleAddEntry} disabled={saving}
              className="flex-1 bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Informations formelles */}
      {emp.is_formal && (emp.cnss_number || emp.contract_type) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Informations contrat</p>
          {emp.cnss_number  && <p className="text-sm text-gray-700">CNSS : {emp.cnss_number}</p>}
          {emp.contract_type && <p className="text-sm text-gray-700">Contrat : {emp.contract_type.toUpperCase()}</p>}
          {emp.contract_start && <p className="text-sm text-gray-700">Début : {fmtDate(emp.contract_start)}</p>}
          {emp.contract_end   && <p className="text-sm text-gray-700">Fin : {fmtDate(emp.contract_end)}</p>}
        </div>
      )}

      {/* Livre de bord */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Livre de bord</p>
        {ledger.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-200 text-gray-400 text-sm">
            Aucune entrée pour l&apos;instant
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
            {ledger.map(entry => {
              const meta = TYPE_LABELS[entry.type]
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-lg mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className={`text-sm font-bold ${meta.color} flex-shrink-0`}>
                        {meta.sign > 0 ? '+' : '−'}{fmtFcfa(Math.abs(entry.amount ?? 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{fmtDate(entry.date)}</p>
                      {entry.units != null && (
                        <p className="text-xs text-gray-400">· {entry.units} unité(s)</p>
                      )}
                      {entry.include_cnss && (
                        <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">CNSS</span>
                      )}
                    </div>
                    {entry.note && <p className="text-xs text-gray-500 mt-1 italic">{entry.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
