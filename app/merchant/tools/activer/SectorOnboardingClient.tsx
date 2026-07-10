'use client'

/**
 * SectorOnboardingClient — Flow d'activation de l'outil sectoriel
 *
 * Non-Pro  → Aperçu Pro + offre exceptionnelle + CTA upgrade
 * Étapes Pro :
 *   0 → Pitch 2 temps (bénéfices Pro déjà inclus → personnalisation offerte)
 *   1-6 → Questionnaire (une question par écran)
 *   7 → Aperçu de l'outil configuré
 *   8 → Confirmation d'activation
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { SECTOR_CONFIGS, type SectorConfig } from '@/lib/tools/sector-configs'

// ─── Types ────────────────────────────────────────────────────────

type Answers = {
  sector: string
  client_type: string
  avg_basket: string
  monthly_volume: string
  main_challenges: string[]
  seniority: string
}

const EMPTY_ANSWERS: Answers = {
  sector: '',
  client_type: '',
  avg_basket: '',
  monthly_volume: '',
  main_challenges: [],
  seniority: '',
}

// ─── Données questionnaire ────────────────────────────────────────

const SECTORS = [
  { key: 'consultant',   label: 'Consultant / Solopreneur', icon: '💼' },
  { key: 'avocat',       label: 'Avocat / Juriste',          icon: '⚖️' },
  { key: 'photographe',  label: 'Photographe / Vidéaste',    icon: '📸' },
  { key: 'transporteur', label: 'Transport / Livraison',     icon: '🚛' },
  { key: 'medecin',      label: 'Médecin / Clinique',        icon: '🏥' },
  { key: 'coach',        label: 'Coach / Formateur',         icon: '🎯' },
  { key: 'evenement',    label: 'Événementiel / Déco',       icon: '🎉' },
  { key: 'imprimerie',   label: 'Imprimerie / Comm visuelle',icon: '🖨️' },
  { key: 'autre',        label: 'Autre activité',            icon: '✨' },
]

const CLIENT_TYPES = [
  { key: 'B2C',   label: 'Particuliers',  icon: '👤', desc: 'Vous vendez à des individus' },
  { key: 'B2B',   label: 'Entreprises',   icon: '🏢', desc: 'Vos clients sont des sociétés' },
  { key: 'mixed', label: 'Les deux',      icon: '🔄', desc: 'Particuliers et entreprises' },
]

const BASKET_RANGES = [
  { key: '<10k',     label: 'Moins de 10 000 FCFA' },
  { key: '10k-50k',  label: '10 000 – 50 000 FCFA' },
  { key: '50k-200k', label: '50 000 – 200 000 FCFA' },
  { key: '>200k',    label: 'Plus de 200 000 FCFA' },
]

const VOLUME_RANGES = [
  { key: '<10',    label: 'Moins de 10 par mois' },
  { key: '10-30',  label: '10 à 30 par mois' },
  { key: '30-100', label: '30 à 100 par mois' },
  { key: '>100',   label: 'Plus de 100 par mois' },
]

const CHALLENGES = [
  { key: 'clients',      label: 'Trouver des clients',          icon: '🎯' },
  { key: 'compta',       label: 'Gérer ma comptabilité',        icon: '📊' },
  { key: 'paiement',     label: 'Me faire payer à temps',       icon: '💰' },
  { key: 'fidelisation', label: 'Fidéliser mes clients',        icon: '❤️' },
  { key: 'temps',        label: 'Gérer mon temps',              icon: '⏰' },
  { key: 'image',        label: 'Professionnaliser mon image',  icon: '✨' },
]

const SENIORITY = [
  { key: '<6m',   label: 'Moins de 6 mois' },
  { key: '6m-2y', label: '6 mois – 2 ans' },
  { key: '2y-5y', label: '2 à 5 ans' },
  { key: '>5y',   label: 'Plus de 5 ans' },
]

// ─── Bénéfices Pro (partagés entre aperçu non-Pro et pitch step 0) ─

const PRO_BENEFITS = [
  { icon: '📄', text: 'Devis & factures illimités' },
  { icon: '📊', text: 'Analytics avancés de votre activité' },
  { icon: '🏅', text: 'Badge marchand certifié sur GreenFlame' },
]

// ─── Composant ────────────────────────────────────────────────────

export default function SectorOnboardingClient({
  businessName,
  isPro,
}: {
  businessName: string
  isPro: boolean
}) {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  const [saving, setSaving]   = useState(false)

  const totalSteps = 6
  const progress   = step >= 1 && step <= totalSteps ? Math.round((step / totalSteps) * 100) : 0
  const config: SectorConfig | null = answers.sector ? (SECTOR_CONFIGS[answers.sector] ?? null) : null

  function setField<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleChallenge(key: string) {
    setAnswers(prev => {
      const has = prev.main_challenges.includes(key)
      if (has) return { ...prev, main_challenges: prev.main_challenges.filter(c => c !== key) }
      if (prev.main_challenges.length >= 2) return prev
      return { ...prev, main_challenges: [...prev.main_challenges, key] }
    })
  }

  function next() { setStep(s => s + 1) }
  function back() { setStep(s => Math.max(0, s - 1)) }

  async function activate() {
    setSaving(true)
    try {
      const res = await fetch('/api/merchant/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (res.ok) {
        setStep(8)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erreur lors de l\'activation')
      }
    } catch {
      toast.error('Erreur réseau — réessayez')
    } finally {
      setSaving(false)
    }
  }

  // ─── APERÇU POUR NON-PRO ─────────────────────────────────────────
  if (!isPro) return (
    <div className="max-w-lg mx-auto p-4 space-y-6 text-center">
      <div className="text-5xl mt-8">🔥</div>
      <div>
        <span className="bg-brand-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Pro
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 leading-snug">
          Votre outil professionnel<br />sur mesure
        </h1>
        <p className="text-gray-500 text-sm mt-3 leading-relaxed">
          Passez au Pro pour débloquer votre espace de travail configuré pour votre secteur d'activité.
        </p>
      </div>

      {/* Temps 1 : Bénéfices Pro */}
      <div className="card text-left space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inclus dans Pro</p>
        {PRO_BENEFITS.map(item => (
          <div key={item.text} className="flex items-center gap-3">
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-gray-700">{item.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <span className="text-sm text-gray-700">Outil sectoriel sur mesure pour votre métier</span>
        </div>
      </div>

      {/* Temps 2 : Offre exceptionnelle */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-left space-y-2">
        <p className="text-green-800 text-sm font-semibold">
          Offre exceptionnelle de lancement
        </p>
        <p className="text-green-600 text-xs leading-relaxed">
          La personnalisation de votre outil à votre secteur est normalement un supplément de{' '}
          <span className="line-through">5 000 FCFA/mois</span>.
          Pendant la période de lancement, elle est{' '}
          <strong className="text-green-700">offerte gratuitement</strong>{' '}
          en répondant à 6 questions rapides.
        </p>
      </div>

      <button
        onClick={() => router.push('/merchant/upgrade?reason=sector_tool')}
        className="btn-primary w-full text-base py-4"
      >
        Passer au Pro pour accéder →
      </button>
      <p className="text-xs text-gray-400">
        Déjà Pro ?{' '}
        <button
          onClick={() => window.location.reload()}
          className="underline hover:text-gray-600"
        >
          Actualisez la page
        </button>
      </p>
    </div>
  )

  // ─── ÉTAPE 0 : Pitch 2 temps (Pro) ───────────────────────────────
  if (step === 0) return (
    <div className="max-w-lg mx-auto p-4 space-y-6 text-center">
      <div className="text-5xl mt-8">🔥</div>
      <div>
        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Offre de lancement
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 leading-snug">
          Votre outil professionnel<br />sur mesure — offert
        </h1>
      </div>

      {/* Temps 1 : Ce que Pro offre déjà */}
      <div className="card text-left space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inclus dans votre abonnement Pro</p>
        {PRO_BENEFITS.map(item => (
          <div key={item.text} className="flex items-center gap-3">
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-gray-700">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Temps 2 : Personnalisation sectorielle = upgrade offert */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-left space-y-2">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">✨</span>
          <div>
            <p className="text-green-800 text-sm font-semibold">
              En plus — Offre exceptionnelle de lancement
            </p>
            <p className="text-green-600 text-xs mt-1 leading-relaxed">
              La personnalisation de votre outil à votre secteur est normalement un supplément de{' '}
              <span className="line-through">5 000 FCFA/mois</span>.
              Pendant le lancement, elle est{' '}
              <strong className="text-green-700">offerte gratuitement</strong>{' '}
              en répondant à 6 questions rapides — votre outil sera configuré sur mesure.
            </p>
          </div>
        </div>
      </div>

      <button onClick={next} className="btn-primary w-full text-base py-4">
        Configurer mon outil gratuitement →
      </button>
      <p className="text-xs text-gray-400">Moins de 2 minutes · Aucun engagement supplémentaire</p>
    </div>
  )

  // ─── ÉTAPES 1-6 : Questions ───────────────────────────────────────
  if (step >= 1 && step <= totalSteps) return (
    <div className="max-w-lg mx-auto p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={back} className="text-gray-600 hover:text-gray-800 text-sm font-medium">← Retour</button>
          <span className="text-xs text-gray-400">{step} / {totalSteps}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div
            className="h-1.5 bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Q1 — Secteur */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Quelle est votre activité principale ?</h2>
          <p className="text-sm text-gray-500">Choisissez le secteur qui correspond le mieux à ce que vous faites.</p>
          <div className="grid grid-cols-2 gap-2">
            {SECTORS.map(s => (
              <button
                key={s.key}
                onClick={() => { setField('sector', s.key); next() }}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  answers.sector === s.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm font-medium leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q2 — Type de clientèle */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Vos clients sont principalement…</h2>
          <p className="text-sm text-gray-500">Cela nous aide à adapter la terminologie de vos documents.</p>
          <div className="space-y-3">
            {CLIENT_TYPES.map(ct => (
              <button
                key={ct.key}
                onClick={() => { setField('client_type', ct.key); next() }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                  answers.client_type === ct.key
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <span className="text-3xl">{ct.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900">{ct.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ct.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q3 — Panier moyen */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Quelle est la valeur typique d'une prestation ?</h2>
          <p className="text-sm text-gray-500">Une estimation suffit — cela pré-remplit intelligemment vos modèles.</p>
          <div className="space-y-2">
            {BASKET_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => { setField('avg_basket', r.key); next() }}
                className={`w-full p-4 rounded-xl border text-left font-medium transition-all ${
                  answers.avg_basket === r.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q4 — Volume mensuel */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Combien de prestations traitez-vous par mois ?</h2>
          <p className="text-sm text-gray-500">En moyenne, sans compter les périodes exceptionnelles.</p>
          <div className="space-y-2">
            {VOLUME_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => { setField('monthly_volume', r.key); next() }}
                className={`w-full p-4 rounded-xl border text-left font-medium transition-all ${
                  answers.monthly_volume === r.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q5 — Défis (multi-choix, max 2) */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Quel est votre plus grand défi ?</h2>
          <p className="text-sm text-gray-500">Choisissez jusqu'à 2 défis. Votre outil mettra ces points en avant.</p>
          <div className="grid grid-cols-2 gap-2">
            {CHALLENGES.map(c => {
              const selected = answers.main_challenges.includes(c.key)
              const disabled = !selected && answers.main_challenges.length >= 2
              return (
                <button
                  key={c.key}
                  onClick={() => toggleChallenge(c.key)}
                  disabled={disabled}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : disabled
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-xs font-medium leading-tight">{c.label}</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={next}
            disabled={answers.main_challenges.length === 0}
            className="btn-primary w-full disabled:opacity-40"
          >
            Continuer →
          </button>
        </div>
      )}

      {/* Q6 — Ancienneté */}
      {step === 6 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Depuis combien de temps exercez-vous ?</h2>
          <p className="text-sm text-gray-500">Dernière question — promis !</p>
          <div className="space-y-2">
            {SENIORITY.map(s => (
              <button
                key={s.key}
                onClick={() => { setField('seniority', s.key); next() }}
                className={`w-full p-4 rounded-xl border text-left font-medium transition-all ${
                  answers.seniority === s.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ─── ÉTAPE 7 : Aperçu de l'outil configuré ───────────────────────
  if (step === 7) {
    const sectorLabel = SECTORS.find(s => s.key === answers.sector)?.label ?? answers.sector
    const sectorIcon  = SECTORS.find(s => s.key === answers.sector)?.icon ?? '✨'

    return (
      <div className="max-w-lg mx-auto p-4 space-y-5">
        <div className="text-center space-y-2 pt-4">
          <div className="text-5xl">{sectorIcon}</div>
          <h1 className="text-xl font-bold text-gray-900">Votre outil est prêt</h1>
          <p className="text-sm text-gray-500">
            GreenFlame a configuré votre espace professionnel pour <strong>{sectorLabel}</strong>
          </p>
        </div>

        <div className="card border-2 border-brand-200 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sectorIcon}</span>
            <div>
              <p className="font-bold text-gray-900">{config?.toolName ?? sectorLabel}</p>
              <p className="text-xs text-gray-400">{config?.documentTitle}</p>
            </div>
            <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              Configuré ✓
            </span>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Vos lignes par défaut</p>
            {(config?.defaultLineItems ?? []).slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                {item.description}
                {item.unit && <span className="text-gray-400 text-xs">({item.unit})</span>}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Personnalisation incluse</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Terminologie', value: config?.clientLabel ?? 'Client' },
                { label: 'Type de clientèle', value: answers.client_type },
                { label: 'Unités', value: (config?.units ?? []).slice(0, 3).join(' · ') },
                { label: 'Champs spéciaux', value: `${config?.extraFields?.length ?? 0} champs` },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-2">
          <p className="text-amber-800 text-sm font-semibold">Valeur débloquée — 15 000 FCFA/mois</p>
          <div className="space-y-1">
            {[
              'Outil sectoriel sur mesure (5 000 FCFA offerts)',
              'Devis & factures illimités',
              'Analytics Pro',
              'Documents à votre image',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-amber-700">
                <span>✓</span><span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={activate}
          disabled={saving}
          className="btn-primary w-full text-base py-4"
        >
          {saving ? 'Activation en cours…' : 'Activer mon outil sectoriel →'}
        </button>
        <button onClick={back} className="w-full text-sm text-gray-400 text-center">
          ← Modifier mes réponses
        </button>
      </div>
    )
  }

  // ─── ÉTAPE 8 : Succès ────────────────────────────────────────────
  if (step === 8) {
    const sectorIcon = SECTORS.find(s => s.key === answers.sector)?.icon ?? '✨'
    return (
      <div className="max-w-lg mx-auto p-4 text-center space-y-6 pt-12">
        <div className="text-6xl">{sectorIcon}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenue dans votre espace Pro</h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            Votre outil professionnel est activé et configuré pour votre activité.
            Il vous attend dans vos outils.
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
          <p className="text-green-700 text-sm font-semibold">
            Personnalisation sectorielle activée ✓
          </p>
          <p className="text-green-600 text-xs mt-1">
            Vous avez économisé 5 000 FCFA grâce à l'offre de lancement
          </p>
        </div>
        <button
          onClick={() => router.push('/merchant/tools')}
          className="btn-primary w-full text-base py-4"
        >
          Accéder à mes outils →
        </button>
      </div>
    )
  }

  return null
}
