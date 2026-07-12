'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  getCategoryMeta,
  GOAL_ICONS,
  GOAL_CATEGORIES,
} from '@/lib/budget/categories'

// ── TYPES ────────────────────────────────────────────────────────────────────

interface BudgetEntry {
  id: string
  type: 'income' | 'expense'
  amount_fcfa: number
  category: string
  label: string | null
  note: string | null
  entry_date: string
  month_key: string
  source: 'manual' | 'gf_transaction'
}

interface BudgetLimit {
  id: string
  category: string
  monthly_limit_fcfa: number
}

interface SavingsGoal {
  id: string
  title: string
  icon: string
  target_amount_fcfa: number
  current_amount_fcfa: number
  deadline: string | null
  goal_category: string | null
  target_monthly_fcfa: number | null
  status: 'active' | 'paused' | 'completed'
}

interface GfTxn {
  id: string
  amount_fcfa: number
  merchant: string
  date: string
}

interface Props {
  initialMonth:   string
  initialEntries: BudgetEntry[]
  initialLimits:  BudgetLimit[]
  initialGoals:   SavingsGoal[]
  walletGf:       number
  initialGfTxns:  GfTxn[]
}

type Tab = 'month' | 'journal' | 'goals'

// ── UTILITAIRES ───────────────────────────────────────────────────────────────

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysLeft(deadline: string | null): string | null {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return 'Dépassé'
  if (diff === 0) return "Aujourd'hui"
  return `${diff} j restants`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────

export default function BudgetClient({
  initialMonth,
  initialEntries,
  initialLimits,
  initialGoals,
  walletGf,
  initialGfTxns,
}: Props) {
  const router = useRouter()
  const [month,   setMonthState] = useState(initialMonth)
  const [tab,     setTab]        = useState<Tab>('month')
  const [entries, setEntries]    = useState<BudgetEntry[]>(initialEntries)
  const [limits,  setLimits]     = useState<BudgetLimit[]>(initialLimits)
  const [goals,   setGoals]      = useState<SavingsGoal[]>(initialGoals)
  const [gfTxns,  setGfTxns]    = useState<GfTxn[]>(initialGfTxns)

  // Modals
  const [showAdd,       setShowAdd]       = useState(false)
  const [showLimit,     setShowLimit]     = useState<string | null>(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editGoal,      setEditGoal]      = useState<SavingsGoal | null>(null)
  const [loading,       setLoading]       = useState(false)

  // ── Navigation mois ───────────────────────────────────────────────────────

  const changeMonth = useCallback(async (m: string) => {
    setMonthState(m)
    router.replace(`/budget?month=${m}`, { scroll: false })
    setLoading(true)
    try {
      const [eRes, gfRes] = await Promise.all([
        fetch(`/api/budget/entries?month=${m}`).then(r => r.json()),
        fetch(`/api/budget/summary?month=${m}`).then(r => r.json()),
      ])
      setEntries(Array.isArray(eRes) ? eRes : [])
      setGfTxns(gfRes.gfTransactions ?? [])
    } finally {
      setLoading(false)
    }
  }, [router])

  // ── Calculs ───────────────────────────────────────────────────────────────

  const { totalIncome, totalExpense, totalGfSpend, expenseByCategory, incomeByCategory } = useMemo(() => {
    const inc = entries.filter(e => e.type === 'income')
    const exp = entries.filter(e => e.type === 'expense')
    const eByC: Record<string, number> = {}
    const iByC: Record<string, number> = {}
    for (const e of exp) eByC[e.category] = (eByC[e.category] ?? 0) + e.amount_fcfa
    for (const e of inc) iByC[e.category] = (iByC[e.category] ?? 0) + e.amount_fcfa
    const gfSpend = gfTxns.reduce((s, t) => s + t.amount_fcfa, 0)
    return {
      totalIncome:       inc.reduce((s, e) => s + e.amount_fcfa, 0),
      totalExpense:      exp.reduce((s, e) => s + e.amount_fcfa, 0),
      totalGfSpend:      gfSpend,
      expenseByCategory: eByC,
      incomeByCategory:  iByC,
    }
  }, [entries, gfTxns])

  const limitsMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of limits) m[l.category] = l.monthly_limit_fcfa
    return m
  }, [limits])

  const netBalance = totalIncome - totalExpense - totalGfSpend

  // ── Actions CRUD ──────────────────────────────────────────────────────────

  const addEntry = useCallback(async (body: Omit<BudgetEntry, 'id' | 'month_key' | 'source'>) => {
    const res = await fetch('/api/budget/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    const entry: BudgetEntry = await res.json()
    setEntries(prev => [entry, ...prev])
    setShowAdd(false)
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    await fetch(`/api/budget/entries/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const setLimit = useCallback(async (category: string, monthly_limit_fcfa: number) => {
    const res = await fetch('/api/budget/limits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, monthly_limit_fcfa }),
    })
    if (!res.ok) throw new Error()
    const updated = await res.json()
    setLimits(prev => {
      const idx = prev.findIndex(l => l.category === category)
      return idx >= 0 ? prev.map((l, i) => i === idx ? updated : l) : [...prev, updated]
    })
    setShowLimit(null)
  }, [])

  const saveGoal = useCallback(async (body: Partial<SavingsGoal>) => {
    if (editGoal) {
      const res = await fetch(`/api/budget/goals/${editGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const updated = await res.json()
      setGoals(prev => prev.map(g => g.id === editGoal.id ? updated : g))
    } else {
      const res = await fetch('/api/budget/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const created = await res.json()
      setGoals(prev => [created, ...prev])
    }
    setShowGoalModal(false)
    setEditGoal(null)
  }, [editGoal])

  const deleteGoal = useCallback(async (id: string) => {
    await fetch(`/api/budget/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
  }, [])

  const updateGoalAmount = useCallback(async (goal: SavingsGoal, delta: number) => {
    const newAmt = Math.max(0, Math.min(goal.current_amount_fcfa + delta, goal.target_amount_fcfa))
    const res = await fetch(`/api/budget/goals/${goal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_amount_fcfa: newAmt,
        status: newAmt >= goal.target_amount_fcfa ? 'completed' : goal.status,
      }),
    })
    const updated = await res.json()
    setGoals(prev => prev.map(g => g.id === goal.id ? updated : g))
  }, [])

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/dashboard" className="p-2 -ml-2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900 flex-1">Mon Budget</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center justify-between">
          <button onClick={() => changeMonth(prevMonth(month))} className="p-2 text-gray-400 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 capitalize">{monthLabel(month)}</span>
          <button
            onClick={() => changeMonth(nextMonth(month))}
            disabled={month >= new Date().toISOString().slice(0, 7)}
            className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-gray-100 rounded-xl p-1">
          {(['month','journal','goals'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t === 'month' ? 'Ce mois' : t === 'journal' ? 'Journal' : 'Objectifs'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && tab === 'month'   && <MonthView  {...{ totalIncome, totalExpense, totalGfSpend, netBalance, walletGf, expenseByCategory, incomeByCategory, limitsMap, showLimit, setShowLimit, setLimit }} />}
        {!loading && tab === 'journal' && <JournalView entries={entries} gfTxns={gfTxns} onDelete={deleteEntry} />}
        {!loading && tab === 'goals'   && (
          <GoalsView
            goals={goals}
            onAdd={() => { setEditGoal(null); setShowGoalModal(true) }}
            onEdit={(g) => { setEditGoal(g); setShowGoalModal(true) }}
            onDelete={deleteGoal}
            onUpdateAmount={updateGoalAmount}
          />
        )}
      </div>

      {/* ── MODAL AJOUT RAPIDE ── */}
      {showAdd && <QuickAddModal onClose={() => setShowAdd(false)} onSave={addEntry} currentMonth={month} />}

      {/* ── MODAL OBJECTIF ── */}
      {showGoalModal && (
        <GoalModal
          initial={editGoal}
          onClose={() => { setShowGoalModal(false); setEditGoal(null) }}
          onSave={saveGoal}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB : CE MOIS
// ─────────────────────────────────────────────────────────────────────────────

function MonthView({
  totalIncome, totalExpense, totalGfSpend, netBalance, walletGf,
  expenseByCategory, incomeByCategory, limitsMap,
  showLimit, setShowLimit, setLimit,
}: {
  totalIncome: number; totalExpense: number; totalGfSpend: number; netBalance: number; walletGf: number
  expenseByCategory: Record<string, number>; incomeByCategory: Record<string, number>
  limitsMap: Record<string, number>
  showLimit: string | null; setShowLimit: (c: string | null) => void
  setLimit: (cat: string, amt: number) => Promise<void>
}) {
  const [limitInput, setLimitInput] = useState('')

  const totalSpend = totalExpense + totalGfSpend

  return (
    <div className="space-y-4">

      {/* BILAN MENSUEL */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bilan du mois</h2>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 font-medium mb-0.5">Revenus</p>
            <p className="text-base font-bold text-green-700">{formatFcfa(totalIncome)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-red-500 font-medium mb-0.5">Dépenses</p>
            <p className="text-base font-bold text-red-600">{formatFcfa(totalSpend)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${netBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <p className={`text-xs font-medium mb-0.5 ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Solde net</p>
            <p className={`text-base font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
              {netBalance >= 0 ? '+' : ''}{formatFcfa(netBalance)}
            </p>
          </div>
        </div>

        {/* Wallet GF disponible */}
        {walletGf > 0 && (
          <Link href="/wallet" className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <div>
                <p className="text-xs font-semibold text-brand-700">Portefeuille GreenFlame</p>
                <p className="text-xs text-brand-500">Utilisables pour tes dépenses sur GF</p>
              </div>
            </div>
            <span className="text-sm font-bold text-brand-700">{formatFcfa(walletGf)}</span>
          </Link>
        )}

        {/* Barre globale revenus vs dépenses */}
        {totalIncome > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>0</span>
              <span>{formatFcfa(totalIncome)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${totalSpend > totalIncome ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min((totalSpend / totalIncome) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">
              {totalIncome > 0 ? Math.round((totalSpend / totalIncome) * 100) : 0}% de tes revenus dépensés
            </p>
          </div>
        )}
      </div>

      {/* ACHATS SUR GreenFlame ce mois */}
      {totalGfSpend > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-brand-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <span className="text-sm font-semibold text-gray-800">Achats GreenFlame</span>
            </div>
            <span className="text-sm font-bold text-brand-700">{formatFcfa(totalGfSpend)}</span>
          </div>
          <p className="text-xs text-gray-400">Inclus dans le total dépenses</p>
        </div>
      )}

      {/* DÉPENSES PAR CATÉGORIE */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dépenses par catégorie</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {EXPENSE_CATEGORIES.map(cat => {
            const spent = expenseByCategory[cat.key] ?? 0
            const limit = limitsMap[cat.key]
            const pct   = limit ? Math.min((spent / limit) * 100, 100) : 0
            const over  = limit ? spent > limit : false
            return (
              <div key={cat.key} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center leading-none">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        {spent > 0 && (
                          <span className={`text-sm font-semibold ${over ? 'text-red-600' : 'text-gray-800'}`}>
                            {formatFcfa(spent)}
                          </span>
                        )}
                        {limit && (
                          <span className="text-xs text-gray-400">/ {formatFcfa(limit)}</span>
                        )}
                      </div>
                    </div>
                    {limit && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-500' : pct > 75 ? 'bg-orange-400' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {over && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Dépassement : {formatFcfa(spent - limit!)}
                      </p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => { setShowLimit(showLimit === cat.key ? null : cat.key); setLimitInput(String(limit ?? '')) }}
                      className="text-xs text-gray-400 hover:text-brand-600 px-1 py-0.5 rounded"
                      title="Définir un plafond"
                    >
                      {limit ? '✏️' : '⚙️'}
                    </button>
                    {cat.gfPath && (
                      <Link href={cat.gfPath} className="text-xs px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-medium hover:bg-brand-100 transition-colors whitespace-nowrap">
                        GF →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Inline limit editor */}
                {showLimit === cat.key && (
                  <LimitInlineForm
                    category={cat.key}
                    current={limit}
                    onSave={(amt) => setLimit(cat.key, amt)}
                    onClose={() => setShowLimit(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* REVENUS PAR CATÉGORIE */}
      {Object.keys(incomeByCategory).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sources de revenus</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {INCOME_CATEGORIES.filter(c => incomeByCategory[c.key]).map(cat => (
              <div key={cat.key} className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg w-6 text-center leading-none">{cat.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-700">{cat.label}</span>
                <span className="text-sm font-bold text-green-700">+{formatFcfa(incomeByCategory[cat.key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LimitInlineForm({
  category, current, onSave, onClose,
}: { category: string; current?: number; onSave: (n: number) => Promise<void>; onClose: () => void }) {
  const [val,  setVal]  = useState(String(current ?? ''))
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-2 flex items-center gap-2 pl-9">
      <input
        type="number"
        placeholder="Plafond mensuel (FCFA)"
        value={val}
        onChange={e => setVal(e.target.value)}
        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
        min="0"
        autoFocus
      />
      <button
        onClick={async () => {
          if (!val || Number(val) <= 0) return
          setBusy(true)
          await onSave(Number(val))
          setBusy(false)
        }}
        disabled={busy}
        className="px-3 py-2 bg-brand-600 text-white text-sm rounded-xl font-medium disabled:opacity-50"
      >
        OK
      </button>
      <button onClick={onClose} className="px-3 py-2 text-gray-500 text-sm">✕</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB : JOURNAL
// ─────────────────────────────────────────────────────────────────────────────

function JournalView({
  entries, gfTxns, onDelete,
}: { entries: BudgetEntry[]; gfTxns: GfTxn[]; onDelete: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')

  const manual = entries.filter(e => filter === 'all' || e.type === filter)

  // Fusionner et trier
  type JournalItem =
    | { kind: 'entry'; data: BudgetEntry }
    | { kind: 'gf';    data: GfTxn }

  const items: JournalItem[] = [
    ...manual.map(e => ({ kind: 'entry' as const, data: e })),
    ...(filter === 'all' || filter === 'expense'
      ? gfTxns.map(t => ({ kind: 'gf' as const, data: t }))
      : []),
  ].sort((a, b) => {
    const da = a.kind === 'entry' ? a.data.entry_date : a.data.date.slice(0, 10)
    const db = b.kind === 'entry' ? b.data.entry_date : b.data.date.slice(0, 10)
    return db.localeCompare(da)
  })

  return (
    <div className="space-y-3">
      {/* Filtre */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['all','income','expense'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {f === 'all' ? 'Tout' : f === 'income' ? '+ Revenus' : '− Dépenses'}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Aucune entrée ce mois-ci</p>
          <p className="text-xs mt-1">Appuie sur + pour ajouter</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
        {items.map((item, i) => {
          if (item.kind === 'gf') {
            const t = item.data
            return (
              <div key={`gf-${t.id}`} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-sm flex-shrink-0">
                  🌱
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.merchant}</p>
                  <p className="text-xs text-gray-400">{formatDate(t.date)} · Via GreenFlame</p>
                </div>
                <span className="text-sm font-semibold text-red-600">−{formatFcfa(t.amount_fcfa)}</span>
              </div>
            )
          }
          const e = item.data
          const cat = getCategoryMeta(e.category)
          return (
            <div key={e.id} className="px-4 py-3 flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {e.label ?? cat.label}
                </p>
                <p className="text-xs text-gray-400">{formatDate(e.entry_date)} · {cat.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${e.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {e.type === 'income' ? '+' : '−'}{formatFcfa(e.amount_fcfa)}
                </span>
                <button
                  onClick={() => onDelete(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB : OBJECTIFS D'ÉPARGNE
// ─────────────────────────────────────────────────────────────────────────────

function GoalsView({
  goals, onAdd, onEdit, onDelete, onUpdateAmount,
}: {
  goals: SavingsGoal[]
  onAdd: () => void
  onEdit: (g: SavingsGoal) => void
  onDelete: (id: string) => Promise<void>
  onUpdateAmount: (g: SavingsGoal, delta: number) => Promise<void>
}) {
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Mes objectifs d'épargne</h2>
        <button
          onClick={onAdd}
          className="text-xs font-semibold text-brand-600 flex items-center gap-1"
        >
          <span>+</span> Nouvel objectif
        </button>
      </div>

      {goals.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm font-semibold text-gray-700">Aucun objectif pour l'instant</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Scolarité, logement, fonds d'urgence…</p>
          <button onClick={onAdd} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-xl font-semibold">
            Créer un objectif
          </button>
        </div>
      )}

      {goals.map(goal => {
        const pct = goal.target_amount_fcfa > 0
          ? Math.min((goal.current_amount_fcfa / goal.target_amount_fcfa) * 100, 100)
          : 0
        const remaining = goal.target_amount_fcfa - goal.current_amount_fcfa
        const dl = daysLeft(goal.deadline)
        const isCompleted = goal.status === 'completed' || pct >= 100

        return (
          <div key={goal.id} className={`bg-white rounded-2xl border p-4 ${isCompleted ? 'border-green-200' : 'border-gray-100'}`}>
            {/* En-tête */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{goal.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{goal.title}</p>
                  {goal.goal_category && (
                    <p className="text-xs text-gray-400">
                      {GOAL_CATEGORIES.find(c => c.key === goal.goal_category)?.label ?? goal.goal_category}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {dl && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    dl === 'Dépassé' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {dl}
                  </span>
                )}
                <button onClick={() => onEdit(goal)} className="text-gray-400 hover:text-gray-600 p-1 text-xs">✏️</button>
                <button onClick={() => onDelete(goal.id)} className="text-gray-300 hover:text-red-500 p-1 text-xs">✕</button>
              </div>
            </div>

            {/* Montants */}
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-semibold text-gray-800">{formatFcfa(goal.current_amount_fcfa)}</span>
              <span>sur {formatFcfa(goal.target_amount_fcfa)}</span>
            </div>

            {/* Barre de progression */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-green-500' : 'bg-brand-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {isCompleted ? (
              <p className="text-xs font-semibold text-green-600 text-center">🎉 Objectif atteint !</p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  {Math.round(pct)}% atteint · encore {formatFcfa(remaining)} à épargner
                </p>

                {/* Ajout d'un versement */}
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Montant versé (FCFA)"
                    value={depositInputs[goal.id] ?? ''}
                    onChange={e => setDepositInputs(p => ({ ...p, [goal.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    min="0"
                  />
                  <button
                    onClick={async () => {
                      const v = Number(depositInputs[goal.id])
                      if (v > 0) {
                        await onUpdateAmount(goal, v)
                        setDepositInputs(p => ({ ...p, [goal.id]: '' }))
                      }
                    }}
                    className="px-3 py-2 bg-brand-600 text-white text-sm rounded-xl font-medium"
                  >
                    ✓
                  </button>
                </div>

                {/* Lien tontine */}
                <Link
                  href={`/tontines?amount=${Math.round(remaining / 12)}&category=${goal.goal_category ?? ''}`}
                  className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 group hover:bg-amber-100 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Épargner collectivement</p>
                    <p className="text-xs text-amber-600">Rejoindre une tontine adaptée</p>
                  </div>
                  <svg className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL : AJOUT RAPIDE (5 secondes)
// ─────────────────────────────────────────────────────────────────────────────

function QuickAddModal({
  onClose, onSave, currentMonth,
}: {
  onClose: () => void
  onSave:  (body: Omit<BudgetEntry, 'id' | 'month_key' | 'source'>) => Promise<void>
  currentMonth: string
}) {
  const [type,     setType]     = useState<'expense' | 'income'>('expense')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState('')
  const [label,    setLabel]    = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [busy,     setBusy]     = useState(false)

  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const handleSave = async () => {
    if (!amount || !category) return
    setBusy(true)
    try {
      await onSave({ type, amount_fcfa: Number(amount), category, label: label || null, note: null, entry_date: date })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl p-5 space-y-4 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
        <h3 className="text-base font-bold text-gray-900 text-center">Ajouter une entrée</h3>

        {/* Type */}
        <div className="flex gap-2">
          <button
            onClick={() => { setType('expense'); setCategory('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            − Dépense
          </button>
          <button
            onClick={() => { setType('income'); setCategory('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${type === 'income' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            + Revenu
          </button>
        </div>

        {/* Montant */}
        <div className="relative">
          <input
            type="number"
            placeholder="Montant"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-xl font-bold focus:outline-none focus:border-brand-400 pr-20"
            min="0"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">FCFA</span>
        </div>

        {/* Catégorie */}
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {cats.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${
                category === c.key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-100 bg-gray-50 text-gray-600'
              }`}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              <span className="text-center leading-tight">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Libellé optionnel */}
        <input
          type="text"
          placeholder="Libellé (optionnel)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-400"
        />

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-400"
        />

        {/* Enregistrer */}
        <button
          onClick={handleSave}
          disabled={!amount || !category || busy}
          className="w-full py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm disabled:opacity-40 transition-opacity"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL : OBJECTIF D'ÉPARGNE
// ─────────────────────────────────────────────────────────────────────────────

function GoalModal({
  initial, onClose, onSave,
}: {
  initial: SavingsGoal | null
  onClose: () => void
  onSave:  (body: Partial<SavingsGoal>) => Promise<void>
}) {
  const [icon,           setIcon]           = useState(initial?.icon ?? '🎯')
  const [title,          setTitle]          = useState(initial?.title ?? '')
  const [target,         setTarget]         = useState(String(initial?.target_amount_fcfa ?? ''))
  const [current,        setCurrent]        = useState(String(initial?.current_amount_fcfa ?? '0'))
  const [deadline,       setDeadline]       = useState(initial?.deadline ?? '')
  const [goalCategory,   setGoalCategory]   = useState(initial?.goal_category ?? '')
  const [targetMonthly,  setTargetMonthly]  = useState(String(initial?.target_monthly_fcfa ?? ''))
  const [busy,           setBusy]           = useState(false)

  const handleSave = async () => {
    if (!title || !target) return
    setBusy(true)
    try {
      await onSave({
        icon,
        title,
        target_amount_fcfa:  Number(target),
        current_amount_fcfa: Number(current || 0),
        deadline:            deadline || null,
        goal_category:       goalCategory || null,
        target_monthly_fcfa: targetMonthly ? Number(targetMonthly) : null,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
        <h3 className="text-base font-bold text-gray-900">
          {initial ? "Modifier l'objectif" : 'Nouvel objectif'}
        </h3>

        {/* Icône */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Icône</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map(i => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                  icon === i ? 'bg-brand-100 ring-2 ring-brand-400' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Titre */}
        <input
          type="text"
          placeholder="Ex : Scolarité 2027, Fonds d'urgence…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-400"
        />

        {/* Montant cible */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Montant cible (FCFA)</p>
            <input
              type="number"
              placeholder="0"
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              min="0"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Déjà épargné (FCFA)</p>
            <input
              type="number"
              placeholder="0"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              min="0"
            />
          </div>
        </div>

        {/* Date cible */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Date cible (optionnel)</p>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        {/* Catégorie + mensualité pour tontine */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Catégorie (pour recommandation tontine)</p>
          <div className="grid grid-cols-3 gap-1.5">
            {GOAL_CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setGoalCategory(goalCategory === c.key ? '' : c.key)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  goalCategory === c.key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-100 text-gray-600'
                }`}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Cotisation mensuelle souhaitée (FCFA)</p>
          <input
            type="number"
            placeholder="Ex : 10 000 FCFA / mois"
            value={targetMonthly}
            onChange={e => setTargetMonthly(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
            min="0"
          />
          <p className="text-xs text-gray-400 mt-1">Sert à filtrer les tontines compatibles</p>
        </div>

        <button
          onClick={handleSave}
          disabled={!title || !target || busy}
          className="w-full py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm disabled:opacity-40"
        >
          {busy ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer l\'objectif'}
        </button>
      </div>
    </div>
  )
}
