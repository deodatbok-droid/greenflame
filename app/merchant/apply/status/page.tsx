'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'

type AppStatus = 'pending_review' | 'assigned' | 'field_verified' | 'pending_admin' | 'approved' | 'rejected'

interface Application {
  id: string
  status: AppStatus
  business_name: string
  created_at: string
  visit_done_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
}

const STATUS_CONFIG: Record<AppStatus, { label: string; icon: string; color: string; desc: string }> = {
  pending_review: {
    label: 'En attente d\'assignation',
    icon:  '📋',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    desc:  'Votre dossier a été reçu. Un agent terrain va être assigné prochainement.',
  },
  assigned: {
    label: 'Agent terrain assigné',
    icon:  '🚴',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    desc:  'Un agent de notre équipe terrain a été assigné à votre dossier et va vous rendre visite.',
  },
  field_verified: {
    label: 'Visite terrain effectuée',
    icon:  '✅',
    color: 'text-green-700 bg-green-50 border-green-200',
    desc:  'La visite terrain est terminée. Votre dossier est en cours d\'examen par l\'équipe GreenFlame.',
  },
  pending_admin: {
    label: 'En validation finale',
    icon:  '⏳',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    desc:  'Votre dossier est entre les mains de notre équipe pour validation finale.',
  },
  approved: {
    label: 'Boutique activée !',
    icon:  '🎉',
    color: 'text-green-700 bg-green-50 border-green-200',
    desc:  'Félicitations ! Votre boutique GreenFlame est maintenant active.',
  },
  rejected: {
    label: 'Demande rejetée',
    icon:  '❌',
    color: 'text-red-700 bg-red-50 border-red-200',
    desc:  'Votre demande n\'a pas pu être acceptée.',
  },
}

const STEPS: AppStatus[] = ['pending_review', 'assigned', 'field_verified', 'pending_admin', 'approved']

export default function ApplicationStatusPage() {
  const [app, setApp]     = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/merchant/apply')
      .then(r => r.json())
      .then(d => { setApp(d.application); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 text-center space-y-4">
        <p className="text-2xl">🏪</p>
        <p className="font-bold text-gray-900">Aucune demande trouvée</p>
        <p className="text-sm text-gray-500">Vous n&apos;avez pas encore soumis de demande d&apos;ouverture de boutique.</p>
        <Link href="/merchant/apply"
          className="inline-block bg-brand-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">
          Ouvrir une boutique →
        </Link>
      </div>
    )
  }

  const cfg        = STATUS_CONFIG[app.status]
  const stepIndex  = STEPS.indexOf(app.status)
  const isApproved = app.status === 'approved'
  const isRejected = app.status === 'rejected'

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-12 space-y-6">
      <div className="flex items-center gap-3">
        <BackButton href="/dashboard" />
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-900">Suivi de votre demande</p>
        <p className="text-sm text-gray-500 mt-1">{app.business_name}</p>
      </div>

      {/* Statut actuel */}
      <div className={`border rounded-2xl p-5 ${cfg.color}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cfg.icon}</span>
          <div>
            <p className="font-bold text-base">{cfg.label}</p>
            <p className="text-sm mt-0.5">{cfg.desc}</p>
          </div>
        </div>
        {isRejected && app.rejection_reason && (
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-sm font-semibold">Motif :</p>
            <p className="text-sm mt-0.5">{app.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Progression (barre d'étapes) */}
      {!isRejected && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Progression</p>
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done    = i < stepIndex || isApproved
              const current = i === stepIndex && !isApproved
              const s       = STATUS_CONFIG[step]
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0
                    ${done    ? 'bg-green-500 text-white' : ''}
                    ${current ? 'bg-brand-600 text-white' : ''}
                    ${!done && !current ? 'bg-gray-100 text-gray-400' : ''}
                  `}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`text-sm ${current ? 'font-bold text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    {s.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dates clés */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Historique</p>
        <DateRow label="Demande soumise"        date={app.created_at} />
        {app.visit_done_at  && <DateRow label="Visite terrain"     date={app.visit_done_at} />}
        {app.reviewed_at    && <DateRow label="Décision finale"    date={app.reviewed_at} />}
      </div>

      {/* CTA selon statut */}
      {isApproved && (
        <Link href="/merchant/dashboard"
          className="block w-full text-center bg-brand-600 text-white font-bold py-4 rounded-2xl hover:bg-brand-700 transition-colors">
          Accéder à ma boutique →
        </Link>
      )}
      {isRejected && (
        <Link href="/merchant/apply"
          className="block w-full text-center bg-gray-800 text-white font-bold py-4 rounded-2xl hover:bg-gray-900 transition-colors">
          Soumettre une nouvelle demande →
        </Link>
      )}
    </div>
  )
}

function DateRow({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-sm font-medium text-gray-900">
        {new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
