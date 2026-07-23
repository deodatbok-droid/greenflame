'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type AppStatus = 'pending_review' | 'assigned' | 'field_verified' | 'pending_admin' | 'approved' | 'rejected'

interface Application {
  id: string
  status: AppStatus
  business_name: string
  business_category: string
  address_text: string
  city: string | null
  neighborhood: string | null
  assigned_at: string | null
  visit_done_at: string | null
  created_at: string
  applicant: { full_name: string; phone: string } | null
}

const STATUS_CFG: Record<AppStatus, { label: string; color: string; priority: number }> = {
  assigned:       { label: 'À visiter',         color: 'text-blue-400 bg-blue-900/40',   priority: 1 },
  field_verified: { label: 'Terrain OK',         color: 'text-amber-400 bg-amber-900/40', priority: 2 },
  pending_admin:  { label: 'En attente admin',   color: 'text-orange-400 bg-orange-900/40', priority: 3 },
  pending_review: { label: 'En attente',         color: 'text-gray-400 bg-gray-700',      priority: 4 },
  approved:       { label: 'Approuvé',           color: 'text-green-400 bg-green-900/40', priority: 5 },
  rejected:       { label: 'Rejeté',             color: 'text-red-400 bg-red-900/40',     priority: 6 },
}

export default function FieldAgentDashboard() {
  const [apps, setApps]       = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<AppStatus | 'active' | 'all'>('active')

  useEffect(() => {
    fetch('/api/fieldagent/applications')
      .then(r => r.json())
      .then(d => { setApps(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const active   = apps.filter(a => !['approved', 'rejected'].includes(a.status))
  const toVisit  = apps.filter(a => a.status === 'assigned')
  const done     = apps.filter(a => a.status === 'pending_admin')

  const displayed = filter === 'all'
    ? [...apps].sort((a, b) => (STATUS_CFG[a.status]?.priority ?? 9) - (STATUS_CFG[b.status]?.priority ?? 9))
    : filter === 'active'
    ? active.sort((a, b) => (STATUS_CFG[a.status]?.priority ?? 9) - (STATUS_CFG[b.status]?.priority ?? 9))
    : apps.filter(a => a.status === filter)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Mes dossiers terrain</h1>
            <p className="text-gray-400 text-sm mt-0.5">{active.length} dossier(s) actif(s)</p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Tableau de bord
          </Link>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="À visiter"       value={toVisit.length}          color="text-blue-400" />
          <StatCard label="Rapport envoyé"  value={done.length}             color="text-orange-400" />
          <StatCard label="Total assignés"  value={apps.length}             color="text-gray-300" />
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/fieldagent/pending-kyc"
            className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center transition-colors">
            <span className="text-2xl block">🪪</span>
            <p className="text-xs text-gray-300 font-medium mt-1">Valider KYC</p>
          </Link>
          <Link href="/fieldagent/enroll-merchant"
            className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center transition-colors">
            <span className="text-2xl block">🏪</span>
            <p className="text-xs text-gray-300 font-medium mt-1">Enrôler marchand</p>
          </Link>
          <Link href="/fieldagent/enroll-user"
            className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center transition-colors">
            <span className="text-2xl block">👤</span>
            <p className="text-xs text-gray-300 font-medium mt-1">Créer un compte</p>
          </Link>
          <Link href="/fieldagent/float"
            className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center transition-colors">
            <span className="text-2xl block">💵</span>
            <p className="text-xs text-gray-300 font-medium mt-1">Mon float</p>
          </Link>
        </div>

        {/* Filtre */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'active', label: 'Actifs' },
            { key: 'assigned', label: 'À visiter' },
            { key: 'pending_admin', label: 'Rapport envoyé' },
            { key: 'all', label: 'Tous' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Aucun dossier</p>
            <p className="text-sm mt-1">Les demandes assignées apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(a => {
              const cfg = STATUS_CFG[a.status]
              const needsVisit = a.status === 'assigned'
              return (
                <Link
                  key={a.id}
                  href={`/fieldagent/applications/${a.id}`}
                  className={`block bg-gray-800 rounded-2xl p-4 hover:bg-gray-700/80 transition-colors ${
                    needsVisit ? 'border border-blue-800/60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white truncate">{a.business_name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{a.applicant?.full_name} · {a.applicant?.phone}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.city ? `${a.city}${a.neighborhood ? ` — ${a.neighborhood}` : ''}` : a.address_text}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{fmtDate(a.created_at)}</p>
                      {needsVisit && (
                        <p className="text-xs text-blue-400 font-medium mt-1">Soumettre rapport →</p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
