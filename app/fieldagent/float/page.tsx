'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'

type EntryType = 'admin_credit' | 'consumer_topup' | 'refund' | 'reconciliation'

interface LedgerEntry {
  id: string
  entry_type: EntryType
  amount_fcfa: number
  balance_after: number
  notes: string | null
  created_at: string
  consumer: { full_name: string; phone: string } | null
}

interface FloatAccount {
  balance_fcfa: number
  float_limit_fcfa: number
  is_active: boolean
}

const ENTRY_CFG: Record<EntryType, { label: string; color: string }> = {
  admin_credit:    { label: 'Crédit admin',      color: 'text-green-400' },
  consumer_topup:  { label: 'Topup consommateur', color: 'text-red-400' },
  refund:          { label: 'Remboursement',      color: 'text-amber-400' },
  reconciliation:  { label: 'Réconciliation',     color: 'text-blue-400' },
}

export default function AgentFloatPage() {
  const [account, setAccount] = useState<FloatAccount | null>(null)
  const [ledger, setLedger]   = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res  = await fetch('/api/fieldagent/float')
    const data = res.ok ? await res.json() : {}
    setAccount(data.account ?? null)
    setLedger(data.ledger ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pct = account ? Math.round((account.balance_fcfa / account.float_limit_fcfa) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Mon float</h1>
            <p className="text-gray-400 text-sm mt-0.5">Caisse terrain GreenFlame</p>
          </div>
          <Link href="/fieldagent/dashboard" className="text-sm text-gray-400 hover:text-white">← Retour</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !account ? (
          <div className="bg-gray-800 rounded-2xl p-8 text-center space-y-3">
            <p className="text-gray-400">Aucun compte float actif.</p>
            <p className="text-sm text-gray-500">Contactez votre administrateur pour l&apos;activation.</p>
          </div>
        ) : (
          <>
            {/* Solde */}
            <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Solde disponible</p>
                  <p className="text-4xl font-bold text-white mt-1">{formatFcfa(account.balance_fcfa)}</p>
                </div>
                {!account.is_active && (
                  <span className="text-xs bg-red-900/40 text-red-400 px-2 py-1 rounded-full font-bold">Désactivé</span>
                )}
              </div>
              {/* Barre de progression */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                  <span>Plafond : {formatFcfa(account.float_limit_fcfa)}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-green-500' : pct > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action rapide */}
            {account.is_active && (
              <Link
                href="/fieldagent/float/topup"
                className="flex items-center justify-between bg-brand-600 hover:bg-brand-700 text-white rounded-2xl px-5 py-4 transition-colors"
              >
                <div>
                  <p className="font-bold">Créditer un consommateur</p>
                  <p className="text-sm text-brand-200 mt-0.5">Convertir du cash en wallet GreenFlame</p>
                </div>
                <span className="text-2xl">→</span>
              </Link>
            )}

            {/* Historique */}
            <div className="bg-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Historique récent</p>
              </div>
              {ledger.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">Aucun mouvement</p>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {ledger.map(entry => {
                    const cfg    = ENTRY_CFG[entry.entry_type] ?? { label: entry.entry_type, color: 'text-gray-400' }
                    const isDebit = entry.amount_fcfa < 0
                    return (
                      <div key={entry.id} className="px-5 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                          {entry.consumer && (
                            <p className="text-sm text-white font-medium truncate">{entry.consumer.full_name}</p>
                          )}
                          {entry.notes && <p className="text-xs text-gray-500 truncate">{entry.notes}</p>}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
                            {isDebit ? '−' : '+'}{formatFcfa(Math.abs(entry.amount_fcfa))}
                          </p>
                          <p className="text-xs text-gray-500">{formatFcfa(entry.balance_after)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
