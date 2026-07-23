'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface KycSubmission {
  id: string
  status: string
  document_type: string
  front_path: string
  back_path: string | null
  created_at: string
  ai_pre_decision: string | null
  ai_confidence: number | null
  ai_extracted_name: string | null
  owner: { id: string; full_name: string; phone: string; kyc_level: number } | null
}

export default function PendingKycPage() {
  const [items, setItems]   = useState<KycSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fieldagent/pending-kyc')
    const data = res.ok ? await res.json() : []
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function approveInPerson(submissionId: string, userName: string) {
    setApproving(submissionId)
    const res  = await fetch(`/api/fieldagent/pending-kyc/${submissionId}/approve`, { method: 'POST' })
    const data = await res.json()
    setApproving(null)
    if (data.ok) {
      toast.success(`KYC de ${userName} approuvé`)
      setItems(prev => prev.filter(i => i.id !== submissionId))
    } else {
      toast.error(data.error ?? 'Erreur')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">KYC en attente</h1>
            <p className="text-gray-400 text-sm mt-0.5">{items.length} dossier(s) à valider</p>
          </div>
          <Link href="/fieldagent/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Retour
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Aucun KYC en attente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-gray-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.owner?.full_name ?? '—'}</p>
                    <p className="text-sm text-gray-400">{item.owner?.phone}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Soumis le {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {item.ai_pre_decision && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">IA pré-décision</p>
                      <p className={`text-xs font-bold mt-0.5 ${
                        item.ai_pre_decision === 'approved' ? 'text-green-400' :
                        item.ai_pre_decision === 'rejected' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {item.ai_pre_decision === 'approved' ? 'OK' :
                         item.ai_pre_decision === 'rejected' ? 'À vérifier' : 'Révision'}
                        {item.ai_confidence != null && ` ${Math.round(item.ai_confidence * 100)}%`}
                      </p>
                      {item.ai_extracted_name && (
                        <p className="text-xs text-gray-500 mt-0.5">"{item.ai_extracted_name}"</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Aperçu docs */}
                <div className="grid grid-cols-2 gap-3">
                  <DocPreview label="CNI Recto" path={item.front_path} />
                  <DocPreview label="CNI Verso" path={item.back_path} />
                </div>

                {/* Action */}
                <button
                  onClick={() => approveInPerson(item.id, item.owner?.full_name ?? 'utilisateur')}
                  disabled={approving === item.id}
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {approving === item.id ? 'Validation…' : 'Valider en personne'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocPreview({ label, path }: { label: string; path: string | null }) {
  if (!path) return (
    <div className="bg-gray-700/50 rounded-xl p-3 text-center h-24 flex flex-col items-center justify-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xs text-gray-600 mt-1">—</p>
    </div>
  )
  const href = path.startsWith('http')
    ? path
    : `/api/admin/kyc-documents/${encodeURIComponent(path)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-gray-700 hover:bg-gray-600 rounded-xl p-3 text-center block transition-colors h-24 flex flex-col items-center justify-center"
    >
      <p className="text-xs text-gray-300 font-medium">{label}</p>
      <p className="text-xs text-brand-400 mt-1">Voir →</p>
    </a>
  )
}
