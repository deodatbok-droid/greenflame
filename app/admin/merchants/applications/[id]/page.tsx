'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

type AppStatus = 'pending_review' | 'assigned' | 'field_verified' | 'pending_admin' | 'approved' | 'rejected'

interface Application {
  id: string
  status: AppStatus
  business_name: string
  business_category: string
  address_text: string
  city: string | null
  neighborhood: string | null
  ifu: string | null
  rccm: string | null
  kyc_front_path: string | null
  kyc_back_path: string | null
  ifu_doc_path: string | null
  rccm_doc_path: string | null
  rejection_reason: string | null
  created_at: string
  assigned_at: string | null
  visit_done_at: string | null
  visit_notes: string | null
  location_confirmed: boolean
  reviewed_at: string | null
  applicant: { full_name: string; phone: string; email: string | null } | null
  agent: { full_name: string } | null
}

const STATUS_LABELS: Record<AppStatus, { label: string; color: string }> = {
  pending_review: { label: 'En attente',         color: 'text-gray-400 bg-gray-800' },
  assigned:       { label: 'Agent assigné',       color: 'text-blue-400 bg-blue-900/40' },
  field_verified: { label: 'Terrain validé',      color: 'text-amber-400 bg-amber-900/40' },
  pending_admin:  { label: 'Validation finale',   color: 'text-orange-400 bg-orange-900/40' },
  approved:       { label: 'Approuvé',            color: 'text-green-400 bg-green-900/40' },
  rejected:       { label: 'Rejeté',              color: 'text-red-400 bg-red-900/40' },
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [app, setApp]               = useState<Application | null>(null)
  const [loading, setLoading]       = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [acting, setActing]         = useState(false)

  useEffect(() => {
    fetch(`/api/admin/merchant-applications/${id}`)
      .then(r => r.json())
      .then(d => { setApp(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function approve() {
    setActing(true)
    const res  = await fetch(`/api/admin/merchant-applications/${id}/approve`, { method: 'POST' })
    const data = await res.json()
    setActing(false)
    if (data.ok) {
      toast.success('Boutique activée avec succès !')
      router.push('/admin/merchants?tab=demandes')
    } else {
      toast.error(data.error ?? 'Erreur')
    }
  }

  async function reject() {
    if (!rejectReason.trim()) { toast.error('Motif requis'); return }
    setActing(true)
    const res  = await fetch(`/api/admin/merchant-applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    const data = await res.json()
    setActing(false)
    if (data.ok) {
      toast.success('Demande rejetée')
      router.push('/admin/merchants?tab=demandes')
    } else {
      toast.error(data.error ?? 'Erreur')
    }
  }

  if (loading) return (
    <div className="flex justify-center pt-16">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!app) return (
    <div className="text-center pt-16 text-gray-400">Demande introuvable</div>
  )

  const cfg = STATUS_LABELS[app.status]
  const canDecide = !['approved', 'rejected'].includes(app.status)

  return (
    <div className="max-w-3xl space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/merchants?tab=demandes" className="hover:text-white">← Demandes</Link>
        <span>/</span>
        <span className="text-gray-300">{app.business_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{app.business_name}</h1>
          <p className="text-gray-400 text-sm mt-1">{app.applicant?.full_name} · {app.applicant?.phone}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Infos boutique */}
        <Section title="Boutique">
          <Row label="Catégorie"   value={app.business_category} />
          <Row label="Adresse"     value={app.address_text} />
          {app.city         && <Row label="Ville"     value={app.city} />}
          {app.neighborhood && <Row label="Quartier"  value={app.neighborhood} />}
          {app.ifu          && <Row label="IFU"       value={app.ifu} />}
          {app.rccm         && <Row label="RCCM"      value={app.rccm} />}
        </Section>

        {/* Workflow */}
        <Section title="Suivi du dossier">
          <Row label="Soumis le"    value={fmt(app.created_at)} />
          {app.assigned_at   && <Row label="Assigné le"    value={fmt(app.assigned_at)} />}
          {app.agent         && <Row label="Agent terrain" value={app.agent.full_name} />}
          {app.visit_done_at && <Row label="Visite le"     value={fmt(app.visit_done_at)} />}
          {app.visit_notes   && <Row label="Notes visite"  value={app.visit_notes} />}
          <Row
            label="Localisation confirmée"
            value={app.location_confirmed ? '✅ Oui' : '⏳ Non encore'}
          />
          {app.reviewed_at      && <Row label="Décision le"   value={fmt(app.reviewed_at)} />}
          {app.rejection_reason && <Row label="Motif rejet"   value={app.rejection_reason} />}
        </Section>
      </div>

      {/* Documents */}
      <Section title="Documents">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DocLink label="CNI Recto"    path={app.kyc_front_path} />
          <DocLink label="CNI Verso"    path={app.kyc_back_path} />
          <DocLink label="IFU"          path={app.ifu_doc_path} />
          <DocLink label="RCCM"         path={app.rccm_doc_path} />
        </div>
      </Section>

      {/* Actions admin */}
      {canDecide && (
        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
          <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Décision finale</p>

          {!showReject ? (
            <div className="flex gap-3">
              <button
                onClick={approve}
                disabled={acting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {acting ? 'Traitement…' : '✅ Approuver — Activer la boutique'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={acting}
                className="flex-1 bg-red-900/50 hover:bg-red-900 text-red-400 font-bold py-3 rounded-xl border border-red-800 transition-colors disabled:opacity-60"
              >
                ❌ Rejeter
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block">
                Motif du rejet *
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Ex : Document IFU illisible, adresse non localisée…"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-red-500 focus:outline-none resize-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={reject}
                  disabled={acting || !rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {acting ? 'Envoi…' : 'Confirmer le rejet'}
                </button>
                <button
                  onClick={() => { setShowReject(false); setRejectReason('') }}
                  className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-5 space-y-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-gray-400 shrink-0">{label}</p>
      <p className="text-sm text-gray-200 text-right">{value}</p>
    </div>
  )
}

function DocLink({ label, path }: { label: string; path: string | null }) {
  if (!path) return (
    <div className="bg-gray-700/50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xs text-gray-600 mt-1">—</p>
    </div>
  )
  return (
    <a
      href={`/api/admin/merchant-documents/${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-gray-700 hover:bg-gray-600 rounded-xl p-3 text-center block transition-colors"
    >
      <p className="text-xs text-gray-300 font-medium">{label}</p>
      <p className="text-xs text-brand-400 mt-1">Voir →</p>
    </a>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
