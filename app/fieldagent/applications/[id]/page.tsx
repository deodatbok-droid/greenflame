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
  applicant: { full_name: string; phone: string; email: string | null } | null
}

const STATUS_CFG: Record<AppStatus, { label: string; color: string }> = {
  pending_review: { label: 'En attente',       color: 'text-gray-400 bg-gray-700' },
  assigned:       { label: 'À visiter',         color: 'text-blue-400 bg-blue-900/40' },
  field_verified: { label: 'Terrain validé',    color: 'text-amber-400 bg-amber-900/40' },
  pending_admin:  { label: 'En validation',     color: 'text-orange-400 bg-orange-900/40' },
  approved:       { label: 'Approuvé',          color: 'text-green-400 bg-green-900/40' },
  rejected:       { label: 'Rejeté',            color: 'text-red-400 bg-red-900/40' },
}

export default function FieldAgentApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [app, setApp]                     = useState<Application | null>(null)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [notes, setNotes]                 = useState('')
  const [locationOk, setLocationOk]      = useState(false)
  const [photo, setPhoto]                 = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/merchant-applications/${id}`)
      .then(r => r.json())
      .then(d => {
        setApp(d)
        if (d.visit_notes)        setNotes(d.visit_notes)
        if (d.location_confirmed) setLocationOk(true)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  async function submitVisit() {
    if (!notes.trim()) { toast.error('Les notes de visite sont obligatoires'); return }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('notes', notes.trim())
    fd.append('location_confirmed', String(locationOk))
    if (photo) fd.append('photo', photo)

    const res  = await fetch(`/api/fieldagent/applications/${id}/visit`, { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)

    if (data.ok) {
      toast.success('Rapport de visite soumis !')
      router.push('/fieldagent/dashboard')
    } else {
      toast.error(data.error ?? 'Erreur lors de la soumission')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!app) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      Dossier introuvable
    </div>
  )

  const cfg        = STATUS_CFG[app.status]
  const canSubmit  = app.status === 'assigned'
  const alreadySent = app.status === 'pending_admin' || app.status === 'approved'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/fieldagent/dashboard" className="hover:text-white">← Mes dossiers</Link>
          <span>/</span>
          <span className="text-gray-300 truncate">{app.business_name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">{app.business_name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{app.applicant?.full_name} · {app.applicant?.phone}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
        </div>

        {/* Infos boutique */}
        <Section title="Informations">
          <Row label="Catégorie"  value={app.business_category} />
          <Row label="Adresse"    value={app.address_text} />
          {app.city         && <Row label="Ville"    value={app.city} />}
          {app.neighborhood && <Row label="Quartier" value={app.neighborhood} />}
          {app.ifu          && <Row label="IFU"      value={app.ifu} />}
          {app.rccm         && <Row label="RCCM"     value={app.rccm} />}
        </Section>

        {/* Carte OpenStreetMap (adresse uniquement, pas de GPS) */}
        <Section title="Localisation à confirmer">
          <div className="rounded-xl overflow-hidden h-52">
            <iframe
              title="Localisation"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=2.1,6.2,2.6,6.6&layer=mapnik`}
              className="w-full h-full border-0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Adresse déclarée : <span className="text-gray-300">{app.address_text}{app.city ? `, ${app.city}` : ''}</span>
          </p>
        </Section>

        {/* Documents */}
        <Section title="Documents à vérifier">
          <div className="grid grid-cols-2 gap-3">
            <DocLink label="CNI Recto" path={app.kyc_front_path} />
            <DocLink label="CNI Verso" path={app.kyc_back_path} />
            <DocLink label="IFU"       path={app.ifu_doc_path} />
            <DocLink label="RCCM"      path={app.rccm_doc_path} />
          </div>
        </Section>

        {/* Rapport déjà soumis */}
        {alreadySent && (
          <div className="bg-orange-900/20 border border-orange-800/40 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-bold text-orange-400 uppercase tracking-widest">Rapport soumis</p>
            {app.visit_notes && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notes de visite</p>
                <p className="text-sm text-gray-200">{app.visit_notes}</p>
              </div>
            )}
            <Row label="Localisation confirmée" value={app.location_confirmed ? 'Oui' : 'Non'} />
          </div>
        )}

        {/* Formulaire rapport — uniquement si status assigned */}
        {canSubmit && (
          <div className="bg-gray-800 rounded-2xl p-5 space-y-5">
            <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Rapport de visite</p>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                Notes *
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Décrivez ce que vous avez observé lors de la visite terrain…"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none resize-none text-sm"
              />
            </div>

            {/* Localisation confirmée */}
            <div className="flex items-center justify-between bg-gray-700/60 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-white font-medium">Localisation confirmée</p>
                <p className="text-xs text-gray-400 mt-0.5">La boutique existe bien à l&apos;adresse déclarée</p>
              </div>
              <button
                onClick={() => setLocationOk(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${locationOk ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${locationOk ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Photo */}
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                Photo de visite (optionnel)
              </label>
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Aperçu" className="w-full h-48 object-cover rounded-xl" />
                  <button
                    onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-brand-500 transition-colors">
                  <span className="text-2xl">📷</span>
                  <span className="text-sm text-gray-400 mt-1">Ajouter une photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>

            <button
              onClick={submitVisit}
              disabled={submitting || !notes.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-60"
            >
              {submitting ? 'Envoi en cours…' : 'Soumettre le rapport de visite'}
            </button>
          </div>
        )}
      </div>
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
