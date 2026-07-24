'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'
import BackButton from '@/components/ui/BackButton'
import SectoralToolPicker from '@/components/merchant/SectoralToolPicker'

type Step = 'plans' | 'tool_select' | 'payment' | 'processing' | 'success' | 'cash' | 'cash_sent'
type Operator = 'mtn_momo' | 'moov_money'
type Tier = 'vip' | 'agent'

const TIER_PRICES: Record<Tier, number> = { vip: 15000, agent: 10000 }

const STANDARD_FEATURES = [
  { icon: '📦', label: '10 produits en vitrine' },
  { icon: '🧾', label: '10 factures & devis / mois' },
  { icon: '📈', label: 'Analytics basique' },
  { icon: '🔗', label: 'Lien de paiement QR' },
  { icon: '💬', label: 'Support communauté' },
  { icon: '🎯', label: 'Score marchand GreenFlame' },
]

// Features VIP en deux groupes : Standard upgradé + extras VIP
const VIP_STANDARD_UPGRADES = [
  { icon: '📦', label: 'Produits illimités', sub: 'vs 10 en Standard' },
  { icon: '🧾', label: 'Factures & devis illimités', sub: 'vs 10/mois' },
  { icon: '📊', label: 'Analytics avancés + Rapport IA', sub: 'vs basique' },
  { icon: '🔗', label: 'Lien de paiement QR', sub: null },
  { icon: '💬', label: 'Support prioritaire', sub: 'vs communauté' },
  { icon: '🎯', label: 'Score marchand GreenFlame', sub: null },
]

const VIP_EXTRAS = [
  { icon: '🏪', label: 'Gestion de boutique', sub: 'Vitrine · POS · Stock · Caisse' },
  { icon: '👥', label: 'Multi-caissiers', sub: null },
  { icon: '🛠️', label: '1 outil sectoriel (1 an)', sub: 'Resto · Couture · BTP…' },
  { icon: '🏦', label: 'Service Agent inclus', sub: 'Dépôts & retraits espèces' },
  { icon: '⭐', label: 'Mise en avant 7 jours', sub: null },
  { icon: '👑', label: 'Badge VIP marchand', sub: null },
]


const AGENT_FEATURES = [
  { icon: '💵', label: 'Dépôts d\'espèces' },
  { icon: '🏧', label: 'Retraits pour clients' },
  { icon: '🔄', label: 'Float = Wallet GreenFlame' },
  { icon: '♾️', label: 'Activation permanente' },
]

const SERVICES = [
  {
    icon: '📲',
    title: 'SMS Promo',
    price: 'À partir de 500 FCFA',
    desc: 'Envoyez des SMS promotionnels à vos clients ayant consenti à recevoir vos offres.',
    action: 'Activer',
    href: '/merchant/promo',
    external: false,
  },
  {
    icon: '🚀',
    title: 'Mise en avant',
    price: 'Plusieurs options',
    desc: 'Boostez la visibilité de votre boutique ou de vos produits sur la plateforme GreenFlame.',
    action: 'Voir les options',
    href: 'https://wa.me/22997025083',
    external: true,
  },
  {
    icon: '🎯',
    title: 'Promotion de produits',
    price: 'À définir',
    desc: 'Mettez en avant des produits spécifiques avec des campagnes ciblées sur la communauté.',
    action: 'Contacter',
    href: 'https://wa.me/22997025083',
    external: true,
  },
]

export default function UpgradePage() {
  const router = useRouter()
  const { t } = useLocale()
  const searchParams = useSearchParams()

  const [step, setStep]                     = useState<Step>('plans')
  const [selectedTier, setSelectedTier]     = useState<Tier>('vip')
  const [selectedTool, setSelectedTool]     = useState<string | null>(null)
  const [cashIntent, setCashIntent]         = useState(false)
  const [phone, setPhone]                   = useState('')
  const [operator, setOperator]             = useState<Operator>('mtn_momo')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [agentActivating, setAgentActivating] = useState(false)
  const [cashPhone, setCashPhone]           = useState('')
  const [cashError, setCashError]           = useState('')
  const [cashLoading, setCashLoading]       = useState(false)
  const [currentTier, setCurrentTier]       = useState<string>('free')
  const [tierExpires, setTierExpires]       = useState<string | null>(null)
  const [businessCategory, setBusinessCategory] = useState<string | undefined>(undefined)

  useEffect(() => {
    const tier = searchParams.get('tier') as Tier | null
    const goToCash = searchParams.get('cash') === '1'
    const toolSelect = searchParams.get('tool_select') === '1'

    if (tier && ['vip', 'agent'].includes(tier)) {
      setSelectedTier(tier)
    }

    fetch('/api/merchant/pnl').then(r => r.json()).then(d => {
      if (d?.subscription_tier)    setCurrentTier(d.subscription_tier)
      if (d?.subscription_expires_at) setTierExpires(d.subscription_expires_at)
      if (d?.business_category)    setBusinessCategory(d.business_category)

      // Sélection d'outil post-paiement pour VIP déjà actif
      if (toolSelect) {
        const isVipNow = d?.subscription_tier === 'vip' &&
          d?.subscription_expires_at &&
          new Date(d.subscription_expires_at) > new Date()
        if (isVipNow) {
          setSelectedTier('vip')
          setStep('tool_select')
          return
        }
      }

      // Préremplissage du plan depuis l'URL
      if (tier === 'vip') {
        setCashIntent(goToCash)
        setStep('tool_select')
      } else if (tier === 'agent') {
        setStep('plans')
      }
    }).catch(() => {})
  }, [searchParams])

  const isVipActive  = currentTier === 'vip'  && !!tierExpires && new Date(tierExpires) > new Date()
  const isAgentActive = currentTier === 'agent'

  const effectiveTier = selectedTier === 'vip' ? 'vip_annual' : selectedTier
  const amount = TIER_PRICES[selectedTier]

  function selectPlan(tier: Tier, goToCash = false) {
    setSelectedTier(tier)
    setError('')
    if (tier === 'vip') {
      setCashIntent(goToCash)
      setStep('tool_select')
    } else {
      setStep(goToCash ? 'cash' : 'payment')
    }
  }

  function proceedFromToolSelect() {
    setStep(cashIntent ? 'cash' : 'payment')
  }

  async function handleActivateTool() {
    if (!selectedTool) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/merchants/tool-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_slug: selectedTool }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('success')
      } else {
        setError(data.error ?? 'Erreur lors de l\'activation')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function handlePay() {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 8) { setError(t('merchant.upgradePage.invalidPhone')); return }
    setError(''); setLoading(true); setStep('processing')
    try {
      const res = await fetch('/api/merchants/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: effectiveTier,
          operator,
          phone: cleaned,
          tool_slug: selectedTool,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('success')
      } else {
        setError(data.error ?? t('merchant.upgradePage.paymentFailed'))
        setStep('payment')
      }
    } catch {
      setError(t('merchant.upgradePage.networkError'))
      setStep('payment')
    } finally {
      setLoading(false)
    }
  }

  async function handleCashRequest() {
    const cleaned = cashPhone.replace(/\D/g, '')
    if (cleaned.length < 8) { setCashError(t('merchant.upgradePage.invalidPhone')); return }
    setCashError(''); setCashLoading(true)
    try {
      const res = await fetch('/api/merchants/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: effectiveTier,
          payment_method: 'cash',
          phone: cleaned,
          tool_slug: selectedTool,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('cash_sent')
      } else {
        setCashError(data.error ?? t('merchant.upgradePage.networkError'))
      }
    } catch {
      setCashError(t('merchant.upgradePage.networkError'))
    } finally {
      setCashLoading(false)
    }
  }

  async function activateAgentFree() {
    setAgentActivating(true); setError('')
    try {
      const res = await fetch('/api/merchants/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'agent', payment_method: 'vip_free' }),
      })
      const data = await res.json()
      if (data.success) {
        setSelectedTier('agent')
        setStep('success')
      } else {
        setError(data.error ?? 'Erreur lors de l\'activation')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setAgentActivating(false)
    }
  }

  const TIER_LABELS: Record<Tier, string> = { vip: 'VIP', agent: 'Service Agent' }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      <div className="flex items-center gap-3">
        <BackButton href="/merchant/abonnements" label="Abonnements" />
      </div>

      {/* ── PLANS ── */}
      {step === 'plans' && (
        <>
          <div className="text-center pb-2">
            <p className="text-2xl font-bold text-gray-900">Abonnements & Services</p>
            <p className="text-sm text-gray-500 mt-1">Choisissez le plan qui correspond à votre activité</p>
          </div>

          <div className="space-y-4">

            {/* Plan Standard */}
            <div className="bg-gradient-to-br from-brand-50 to-brand-100 border-2 border-brand-200 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-brand-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                Inclus gratuitement
              </div>
              <h2 className="text-xl font-bold text-gray-900">⚡ Standard</h2>
              <div className="flex items-baseline gap-1 mt-1 mb-4">
                <span className="text-3xl font-bold text-brand-700">Gratuit</span>
                <span className="text-gray-500 text-sm">· pour tous les marchands</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {STANDARD_FEATURES.map(f => (
                  <div key={f.label} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{f.icon}</span><span>{f.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-brand-600/10 rounded-xl px-4 py-2.5">
                <span className="text-lg">✅</span>
                <p className="text-sm font-semibold text-brand-800">Votre plan actuel — déjà actif</p>
              </div>
            </div>

            {/* Plan VIP */}
            <div className={`bg-gradient-to-br from-amber-50 to-amber-100 border-2 rounded-2xl p-5 relative overflow-hidden ${isVipActive ? 'border-amber-300 opacity-70' : 'border-amber-500'}`}>
              {isVipActive ? (
                <div className="absolute top-4 right-4 bg-amber-200 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  Actif
                </div>
              ) : (
                <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  Recommandé
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">👑 VIP</h2>
              <div className="flex items-baseline gap-1 mt-2 mb-4">
                <span className="text-3xl font-bold text-amber-700">15 000</span>
                <span className="text-gray-500 text-sm">FCFA / an</span>
              </div>
              {/* Standard inclus & amélioré */}
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Standard inclus & amélioré</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                {VIP_STANDARD_UPGRADES.map(f => (
                  <div key={f.label} className="flex items-start gap-1.5 min-w-0">
                    <span className="text-sm shrink-0 mt-0.5">{f.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{f.label}</p>
                      {f.sub && <p className="text-[10px] text-amber-600 leading-tight">{f.sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Extras VIP */}
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">En plus avec le VIP</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-5">
                {VIP_EXTRAS.map(f => (
                  <div key={f.label} className="flex items-start gap-1.5 min-w-0">
                    <span className="text-sm shrink-0 mt-0.5">{f.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{f.label}</p>
                      {f.sub && <p className="text-[10px] text-amber-600 leading-tight">{f.sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {!isVipActive && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => selectPlan('vip')}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Passer au VIP — 15 000 FCFA / an →
                  </button>
                  <button
                    onClick={() => selectPlan('vip', true)}
                    className="w-full bg-white border-2 border-amber-300 text-amber-700 font-semibold py-2.5 rounded-xl hover:bg-amber-50 transition-colors"
                  >
                    Payer en espèces
                  </button>
                </div>
              )}
            </div>

            {/* Service Agent */}
            <div className={`bg-blue-50 border-2 border-blue-300 rounded-2xl p-5 relative overflow-hidden ${isAgentActive ? 'opacity-70' : ''}`}>
              {isAgentActive && (
                <div className="absolute top-4 right-4 bg-blue-200 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  Actif
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">🏦 Service Agent</h2>
              <div className="flex items-baseline gap-1 mt-1 mb-1">
                <span className="text-3xl font-bold text-blue-700">Gratuit</span>
                <span className="text-gray-500 text-sm ml-1">· avec le plan VIP</span>
              </div>
              <p className="text-xs text-blue-700 mb-1 font-medium">⚠️ Float initial requis — montant défini à l&apos;activation</p>
              <p className="text-xs text-amber-700 mb-4 font-medium">👑 Plan VIP requis pour activer et maintenir ce service</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {AGENT_FEATURES.map(f => (
                  <div key={f.label} className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{f.icon}</span><span>{f.label}</span>
                  </div>
                ))}
              </div>
              {!isAgentActive && (
                isVipActive ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={activateAgentFree}
                      disabled={agentActivating}
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      {agentActivating ? 'Activation en cours…' : 'Activer gratuitement — inclus dans votre VIP'}
                    </button>
                    {error && <p className="text-red-600 text-xs text-center">{error}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => selectPlan('vip')}
                    className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-colors"
                  >
                    Souscrire au VIP d&apos;abord →
                  </button>
                )
              )}
            </div>

            {/* Services additionnels */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-gray-200" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Services additionnels</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid gap-3">
                {SERVICES.map(s => (
                  <div key={s.title} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <span className="text-2xl shrink-0">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                        <span className="text-xs font-bold text-brand-600 whitespace-nowrap shrink-0">{s.price}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                    {s.external ? (
                      <a href={s.href} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200">
                        {s.action}
                      </a>
                    ) : (
                      <Link href={s.href}
                        className="shrink-0 text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200">
                        {s.action}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link href="/merchant/dashboard" className="text-sm text-gray-500 hover:text-gray-600 transition-colors">
              Retour au tableau de bord
            </Link>
          </div>
        </>
      )}

      {/* ── SÉLECTION OUTIL SECTORIEL ── */}
      {step === 'tool_select' && (
        <div className="space-y-5">
          <button onClick={() => setStep('plans')} className="text-sm text-brand-600 font-semibold">
            ← Retour aux offres
          </button>

          <div>
            <p className="text-2xl font-bold text-gray-900">🛠️ Votre outil sectoriel</p>
            <p className="text-sm text-gray-500 mt-1">
              Inclus dans votre abonnement VIP — valable 1 an. Choisissez l&apos;outil adapté à votre activité.
            </p>
          </div>

          <SectoralToolPicker
            value={selectedTool}
            onChange={setSelectedTool}
            businessCategory={businessCategory}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          {/* CTA selon le contexte */}
          {isVipActive ? (
            /* Déjà VIP → activation directe sans paiement */
            <div className="flex flex-col gap-2">
              <button
                onClick={handleActivateTool}
                disabled={!selectedTool || loading}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Activation en cours…' : 'Activer cet outil'}
              </button>
            </div>
          ) : (
            /* Nouveau VIP → continuer vers paiement */
            <div className="flex flex-col gap-2">
              <button
                onClick={proceedFromToolSelect}
                disabled={!selectedTool}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Continuer {cashIntent ? 'vers le paiement espèces' : 'vers le paiement'}
              </button>
              <button
                onClick={() => {
                  setSelectedTool(null)
                  proceedFromToolSelect()
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-600 py-2 text-center transition-colors"
              >
                Choisir mon outil plus tard
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ESPÈCES ── */}
      {step === 'cash' && (
        <div className="space-y-4">
          <button onClick={() => setStep('tool_select')} className="text-sm text-brand-600 font-semibold">
            ← Retour au choix de l&apos;outil
          </button>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">💵</div>
              <h2 className="text-xl font-bold text-gray-900">Paiement en espèces</h2>
              <p className="text-sm text-gray-500 mt-1">
                {TIER_LABELS[selectedTier]}
                {selectedTier === 'vip' && <span className="ml-1 text-amber-700 font-medium">(annuel)</span>}
                {' · '}<strong>{amount.toLocaleString('fr-FR')} FCFA</strong>
              </p>
              {selectedTool && (
                <p className="text-xs text-brand-600 mt-0.5">Outil sectoriel : <strong>{selectedTool}</strong></p>
              )}
            </div>

            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏪</span>
                <div>
                  <p className="font-semibold text-brand-900">GreenFlame Hub</p>
                  <p className="text-sm text-brand-700">Déodat BOKONONHOUI</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide block mb-1.5">
                Votre numéro de téléphone
              </label>
              <PhoneInput value={cashPhone} onChange={setCashPhone} placeholder="XX XX XX XX" />
              <p className="text-xs text-gray-500 mt-1.5">Déodat vous rappellera pour confirmer le paiement.</p>
            </div>

            {cashError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{cashError}</div>
            )}

            <button
              onClick={handleCashRequest}
              disabled={cashLoading}
              className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {cashLoading ? 'Envoi en cours…' : 'Enregistrer ma demande'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">ou contacter directement</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <a href="https://wa.me/22997025083" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors">
              <span>💬</span> Contacter via WhatsApp
            </a>

            <Link href="/merchant/dashboard" className="block text-center text-sm text-gray-500 hover:text-gray-600">
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      )}

      {/* ── DEMANDE ESPÈCES CONFIRMÉE ── */}
      {step === 'cash_sent' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">📋</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">Demande enregistrée !</p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Votre demande pour le plan {TIER_LABELS[selectedTier]} ({amount.toLocaleString('fr-FR')} FCFA) a été transmise à l&apos;équipe GreenFlame.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-left space-y-1.5">
            <p className="text-amber-800 font-semibold">Prochaines étapes</p>
            <ol className="text-amber-700 space-y-1 list-decimal list-inside">
              <li>Contactez Déodat au GreenFlame Hub</li>
              <li>Réglez {amount.toLocaleString('fr-FR')} FCFA en espèces</li>
              <li>Déodat confirme le paiement</li>
              <li>Votre plan {TIER_LABELS[selectedTier]} est activé automatiquement</li>
            </ol>
          </div>
          <a href="https://wa.me/22997025083" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors">
            <span>💬</span> Contacter via WhatsApp
          </a>
          <Link href="/merchant/abonnements" className="block text-sm text-gray-500 hover:text-gray-600">
            Retour aux abonnements
          </Link>
        </div>
      )}

      {/* ── PAIEMENT MOBILE MONEY ── */}
      {step === 'payment' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <button onClick={() => setStep('tool_select')} className="text-sm text-brand-600 font-semibold">
            ← Retour au choix de l&apos;outil
          </button>
          <h2 className="text-xl font-bold text-gray-900">Paiement Mobile Money</h2>
          <p className="text-sm text-gray-500">
            {TIER_LABELS[selectedTier]}
            {selectedTier === 'vip' && <span className="ml-1 text-amber-700 font-medium">(annuel)</span>}
            {' · '}<strong>{amount.toLocaleString('fr-FR')} FCFA</strong>
          </p>
          {selectedTool && (
            <p className="text-xs text-brand-600">+ Outil sectoriel : <strong>{selectedTool}</strong></p>
          )}

          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Opérateur</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'mtn_momo', label: 'MTN MoMo', color: 'bg-yellow-400', prefix: '+229 6' },
                { id: 'moov_money', label: 'Moov Money', color: 'bg-blue-500', prefix: '+229 9' },
              ] as const).map(op => (
                <button key={op.id} onClick={() => setOperator(op.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${operator === op.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className={`w-6 h-6 ${op.color} rounded-full mb-2`} />
                  <p className="text-sm font-semibold text-gray-900">{op.label}</p>
                  <p className="text-xs text-gray-500">ex: {op.prefix}XXXXXXX</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide block mb-1.5">
              Numéro {operator === 'mtn_momo' ? 'MTN' : 'Moov'}
            </label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder={operator === 'mtn_momo' ? '6X XX XX XX' : '9X XX XX XX'}
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <button onClick={handlePay} disabled={loading}
            className="w-full bg-brand-600 text-white font-bold py-4 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60">
            Payer {amount.toLocaleString('fr-FR')} FCFA
          </button>
          <p className="text-xs text-gray-500 text-center">Vous recevrez une notification sur votre téléphone pour confirmer.</p>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {step === 'processing' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <span className="text-3xl">📲</span>
          </div>
          <p className="font-semibold text-gray-900 text-lg">Paiement en cours…</p>
          <p className="text-sm text-gray-500">Confirmez le paiement de {amount.toLocaleString('fr-FR')} FCFA sur votre téléphone.</p>
          <div className="flex justify-center gap-1 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── SUCCÈS ── */}
      {step === 'success' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">{selectedTier === 'vip' ? '👑' : '🏦'}</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {isVipActive && selectedTool
                ? 'Outil sectoriel activé !'
                : `Plan ${TIER_LABELS[selectedTier]} activé !`}
            </p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {selectedTier === 'vip'
                ? selectedTool
                  ? 'Votre outil sectoriel est maintenant disponible dans votre espace marchand.'
                  : 'Vitrine publique, multi-caissiers, analytics avancés, POS, Stock et Livre de caisse débloqués.'
                : 'Vous pouvez maintenant effectuer des dépôts et retraits d\'espèces pour vos clients.'}
            </p>
          </div>
          <button
            onClick={() => router.push('/merchant/abonnements')}
            className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            Voir mes abonnements
          </button>
          <Link href="/merchant/tools" className="block text-sm text-gray-500 hover:text-gray-600">
            Découvrir mes outils
          </Link>
        </div>
      )}

    </div>
  )
}
