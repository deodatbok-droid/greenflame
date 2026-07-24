'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import toast from 'react-hot-toast'

type Step = 'kyc_check' | 'boutique' | 'documents' | 'localisation' | 'recap' | 'submitting' | 'success'

const CATEGORIES = [
  { code: 'ALIMENTATION',    label: 'Alimentation générale',       emoji: '🛒' },
  { code: 'RESTAURANT',      label: 'Restauration',                emoji: '🍽️' },
  { code: 'BEAUTE',          label: 'Beauté & cosmétiques',        emoji: '💄' },
  { code: 'PHARMACIE',       label: 'Pharmacie & santé',           emoji: '💊' },
  { code: 'ELECTRONIQUE',    label: 'Électronique & téléphonie',   emoji: '📱' },
  { code: 'VETEMENTS',       label: 'Vêtements & chaussures',      emoji: '👗' },
  { code: 'SERVICES',        label: 'Services divers',             emoji: '🔧' },
  { code: 'TRANSPORT_SMALL', label: 'Transport / Zémidjan',        emoji: '🛵' },
  { code: 'GROSSISTE',       label: 'Grossiste (B2B)',             emoji: '🏭' },
]

export default function MerchantApplyPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('kyc_check')
  const [kycApproved, setKycApproved] = useState(false)
  const [checking, setChecking] = useState(true)

  // Infos boutique
  const [businessName, setBusinessName]         = useState('')
  const [businessCategory, setBusinessCategory] = useState('')
  const [addressText, setAddressText]           = useState('')
  const [city, setCity]                         = useState('')
  const [neighborhood, setNeighborhood]         = useState('')
  const [ifu, setIfu]                           = useState('')
  const [rccm, setRccm]                         = useState('')

  // Documents
  const [ifuDoc, setIfuDoc]   = useState<File | null>(null)
  const [rccmDoc, setRccmDoc] = useState<File | null>(null)
  const [kycFront, setKycFront] = useState<File | null>(null)
  const [kycBack, setKycBack]   = useState<File | null>(null)

  // Localisation
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError]     = useState('')

  // Vérification initiale : statut KYC + demande existante + déjà marchand
  useEffect(() => {
    fetch('/api/merchant/apply')
      .then(r => r.json())
      .then(data => {
        if (data.alreadyMerchant) {
          router.replace('/merchant/dashboard')
          return
        }
        if (data.application && data.application.status !== 'rejected') {
          router.replace('/merchant/apply/status')
          return
        }
        setKycApproved(!!data.kycApproved)
        setChecking(false)
        setStep('boutique')
      })
      .catch(() => {
        setChecking(false)
        setStep('boutique')
      })
  }, [router])

  function getGps() {
    setGpsError('')
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setGpsLoading(false)
      },
      err => {
        setGpsError('Impossible d\'obtenir votre position. Vérifiez les permissions.')
        setGpsLoading(false)
        console.error(err)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit() {
    setStep('submitting')

    const form = new FormData()
    form.append('business_name',     businessName)
    form.append('business_category', businessCategory)
    form.append('address_text',      addressText)
    if (city)         form.append('city',         city)
    if (neighborhood) form.append('neighborhood', neighborhood)
    form.append('ifu', ifu)
    if (rccm)    form.append('rccm',     rccm)
    if (lat)     form.append('lat',      String(lat))
    if (lng)     form.append('lng',      String(lng))
    if (ifuDoc)  form.append('ifu_doc',  ifuDoc)
    if (rccmDoc) form.append('rccm_doc', rccmDoc)
    if (!kycApproved) {
      if (kycFront) form.append('kyc_front', kycFront)
      if (kycBack)  form.append('kyc_back',  kycBack)
    }

    try {
      const res  = await fetch('/api/merchant/apply', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setStep('success')
      } else {
        toast.error(data.error ?? 'Erreur lors de la soumission')
        setStep('recap')
      }
    } catch {
      toast.error('Erreur réseau')
      setStep('recap')
    }
  }

  // ── Chargement initial ──────────────────────────────────────────────────
  if (checking || step === 'kyc_check') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Vérification de votre profil…</p>
      </div>
    )
  }

  // ── Succès ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 pb-12">
        <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🎉</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">Demande envoyée !</p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Votre dossier a été transmis à notre équipe. Un agent terrain va être assigné
              et vous rendra visite pour confirmer votre emplacement avant l&apos;activation.
            </p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold text-brand-900">Prochaines étapes</p>
            <ol className="text-sm text-brand-700 space-y-1 list-decimal list-inside">
              <li>Un agent GreenFlame vous contacte</li>
              <li>Visite terrain pour confirmer la localisation</li>
              <li>Validation finale par l&apos;équipe GreenFlame</li>
              <li>Votre boutique est activée 🚀</li>
            </ol>
          </div>
          <button
            onClick={() => router.push('/merchant/apply/status')}
            className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            Suivre ma demande →
          </button>
        </div>
      </div>
    )
  }

  // ── En cours de soumission ───────────────────────────────────────────────
  if (step === 'submitting') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Envoi de votre dossier…</p>
      </div>
    )
  }

  const steps: Step[] = ['boutique', 'documents', 'localisation', 'recap']
  const currentIndex  = steps.indexOf(step)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton href="/dashboard" />
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-900">Ouvrir ma boutique</p>
        <p className="text-sm text-gray-500 mt-1">Remplissez votre dossier — notre équipe terrain viendra confirmer avant activation.</p>
      </div>

      {/* Barre de progression */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= currentIndex ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* ── ÉTAPE 1 : Informations boutique ──────────────────────────── */}
      {step === 'boutique' && (
        <div className="space-y-5">
          <StepTitle step={1} total={4} label="Informations boutique" />

          <Field label="Nom de la boutique *">
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Ex : Boutique Amavi"
              className="input"
            />
          </Field>

          <Field label="Catégorie d'activité *">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setBusinessCategory(cat.code)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-sm
                    ${businessCategory === cat.code
                      ? 'border-brand-500 bg-brand-50 text-brand-800 font-semibold'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                >
                  <span>{cat.emoji}</span>
                  <span className="leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Adresse complète *">
            <input
              value={addressText}
              onChange={e => setAddressText(e.target.value)}
              placeholder="Ex : Quartier Zogbo, face station Total"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ville">
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Ex : Cotonou"
                className="input"
              />
            </Field>
            <Field label="Quartier">
              <input
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Ex : Akpakpa"
                className="input"
              />
            </Field>
          </div>

          <Field label="Numéro IFU *" hint="Identifiant Fiscal Unique — obligatoire">
            <input
              value={ifu}
              onChange={e => setIfu(e.target.value)}
              placeholder="Ex : 3202300123456"
              className="input"
            />
          </Field>

          <Field label="Numéro RCCM" hint="Registre du Commerce — si applicable">
            <input
              value={rccm}
              onChange={e => setRccm(e.target.value)}
              placeholder="Ex : RB/COT/24 A 12345"
              className="input"
            />
          </Field>

          <NextButton
            disabled={!businessName.trim() || !businessCategory || !addressText.trim() || !ifu.trim()}
            onClick={() => setStep('documents')}
          />
        </div>
      )}

      {/* ── ÉTAPE 2 : Documents ──────────────────────────────────────── */}
      {step === 'documents' && (
        <div className="space-y-5">
          <StepTitle step={2} total={4} label="Documents" />

          {/* KYC */}
          {kycApproved ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <span className="text-xl">✅</span>
              <div>
                <p className="font-semibold text-green-800 text-sm">KYC déjà validé</p>
                <p className="text-xs text-green-700 mt-0.5">Votre pièce d&apos;identité a déjà été vérifiée — pas besoin de la resoumettre.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Pièce d&apos;identité (CNI) *</p>
                <p className="text-xs text-gray-500 mt-0.5">Votre pièce d&apos;identité servira également pour la vérification de votre compte.</p>
              </div>
              <FileField label="Recto *" file={kycFront} onChange={setKycFront} accept="image/*" />
              <FileField label="Verso *" file={kycBack}  onChange={setKycBack}  accept="image/*" />
            </div>
          )}

          {/* IFU */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-gray-900 text-sm">Document IFU *</p>
            <FileField
              label="Attestation IFU *"
              file={ifuDoc}
              onChange={setIfuDoc}
              accept="image/*,application/pdf"
            />
          </div>

          {/* RCCM */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-gray-900 text-sm">Document RCCM <span className="font-normal text-gray-400">(optionnel)</span></p>
            <FileField
              label="Registre du Commerce"
              file={rccmDoc}
              onChange={setRccmDoc}
              accept="image/*,application/pdf"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('boutique')}
              className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl hover:border-gray-300 transition-colors"
            >
              ← Retour
            </button>
            <NextButton
              className="flex-[2]"
              disabled={
                (!kycApproved && (!kycFront || !kycBack)) ||
                !ifuDoc
              }
              onClick={() => setStep('localisation')}
            />
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : Localisation ───────────────────────────────────── */}
      {step === 'localisation' && (
        <div className="space-y-5">
          <StepTitle step={3} total={4} label="Localisation" />

          <p className="text-sm text-gray-500">
            Nous avons besoin de votre position GPS pour que notre équipe terrain puisse vous retrouver facilement.
          </p>

          {lat && lng ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="font-semibold text-green-800 text-sm">Position capturée</p>
                  <p className="text-xs text-green-700 font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                </div>
                <button
                  onClick={() => { setLat(null); setLng(null) }}
                  className="ml-auto text-xs text-green-600 underline"
                >
                  Recapturer
                </button>
              </div>
              {/* Carte OpenStreetMap iframe */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 h-48">
                <iframe
                  title="Carte position"
                  width="100%"
                  height="100%"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`}
                  style={{ border: 0 }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={getGps}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-3 bg-brand-600 text-white font-bold py-4 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {gpsLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Localisation en cours…
                  </>
                ) : (
                  <>📍 Utiliser ma position GPS</>
                )}
              </button>
              {gpsError && (
                <p className="text-sm text-red-600 text-center">{gpsError}</p>
              )}
              <p className="text-xs text-gray-400 text-center">
                Assurez-vous d&apos;être à l&apos;emplacement de votre boutique au moment de la capture.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('documents')}
              className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl hover:border-gray-300 transition-colors"
            >
              ← Retour
            </button>
            <NextButton
              className="flex-[2]"
              label="Continuer"
              disabled={!lat || !lng}
              onClick={() => setStep('recap')}
            />
          </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : Récapitulatif ──────────────────────────────────── */}
      {step === 'recap' && (
        <div className="space-y-5">
          <StepTitle step={4} total={4} label="Récapitulatif" />

          <RecapCard title="Boutique">
            <RecapRow label="Nom"        value={businessName} />
            <RecapRow label="Catégorie"  value={CATEGORIES.find(c => c.code === businessCategory)?.label ?? businessCategory} />
            <RecapRow label="Adresse"    value={addressText} />
            {city         && <RecapRow label="Ville"      value={city} />}
            {neighborhood && <RecapRow label="Quartier"   value={neighborhood} />}
          </RecapCard>

          <RecapCard title="Documents fiscaux">
            <RecapRow label="IFU"  value={ifu} />
            {rccm && <RecapRow label="RCCM" value={rccm} />}
            <RecapRow label="Document IFU"  value={ifuDoc?.name  ?? '—'} />
            {rccmDoc && <RecapRow label="Document RCCM" value={rccmDoc.name} />}
          </RecapCard>

          <RecapCard title="Identité">
            {kycApproved ? (
              <RecapRow label="CNI" value="✅ Déjà vérifiée" />
            ) : (
              <>
                <RecapRow label="CNI recto" value={kycFront?.name ?? '—'} />
                <RecapRow label="CNI verso" value={kycBack?.name  ?? '—'} />
              </>
            )}
          </RecapCard>

          <RecapCard title="Localisation">
            <RecapRow label="GPS" value={`${lat?.toFixed(5)}, ${lng?.toFixed(5)}`} />
          </RecapCard>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 leading-relaxed">
              ⚠️ En soumettant ce dossier, vous confirmez que toutes les informations fournies sont exactes et que vous consentez à une visite de notre équipe terrain pour valider votre emplacement.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('localisation')}
              className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl hover:border-gray-300 transition-colors"
            >
              ← Retour
            </button>
            <button
              onClick={handleSubmit}
              className="flex-[2] bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
            >
              Envoyer mon dossier →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composants utilitaires ───────────────────────────────────────────────────

function StepTitle({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">Étape {step}/{total}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{label}</p>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block">{label}</label>
      {hint && <p className="text-xs text-gray-400 -mt-0.5">{hint}</p>}
      {children}
    </div>
  )
}

function FileField({
  label, file, onChange, accept,
}: {
  label: string
  file: File | null
  onChange: (f: File | null) => void
  accept: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`w-full flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 text-left transition-colors
          ${file ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
      >
        <span className="text-xl">{file ? '📄' : '📎'}</span>
        <span className={`text-sm truncate ${file ? 'text-brand-800 font-medium' : 'text-gray-400'}`}>
          {file ? file.name : 'Appuyer pour choisir un fichier'}
        </span>
        {file && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="ml-auto text-gray-400 hover:text-red-500 text-lg leading-none"
          >
            ×
          </button>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

function NextButton({
  onClick, disabled, label = 'Continuer →', className = 'w-full',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${className} bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  )
}

function RecapCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-gray-500 shrink-0">{label}</p>
      <p className="text-sm font-medium text-gray-900 text-right truncate max-w-[60%]">{value}</p>
    </div>
  )
}
