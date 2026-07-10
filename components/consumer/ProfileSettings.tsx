'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface PromoMerchant {
  id: string
  business_name: string
  public_slug: string | null
  opted_out: boolean
}

function PromoOptOutPanel() {
  const [merchants, setMerchants] = useState<PromoMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/promo-optouts')
      .then(r => r.json())
      .then(d => setMerchants(d.merchants ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(merchantId: string, currentOptedOut: boolean) {
    setToggling(merchantId)
    try {
      const res = await fetch('/api/user/promo-optouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: merchantId, opted_out: !currentOptedOut }),
      })
      if (res.ok) {
        setMerchants(prev => prev.map(m =>
          m.id === merchantId ? { ...m, opted_out: !currentOptedOut } : m
        ))
      }
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <p className="text-xs text-gray-400 py-2">Chargement…</p>
  if (merchants.length === 0) {
    return <p className="text-xs text-gray-400 py-2">Aucun achat effectué pour l'instant.</p>
  }

  return (
    <div className="space-y-3">
      {merchants.map(m => (
        <div key={m.id} className="flex items-center justify-between">
          <p className="text-sm text-gray-800 font-medium truncate mr-3">{m.business_name}</p>
          <button
            onClick={() => toggle(m.id, m.opted_out)}
            disabled={toggling === m.id}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              m.opted_out ? 'bg-gray-200' : 'bg-brand-600'
            } disabled:opacity-60`}
            title={m.opted_out ? 'Réactiver les offres' : 'Désactiver les offres'}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                m.opted_out ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        Désactiver = vous ne recevrez plus les offres promo de ce marchand. Vous continuez à recevoir les notifications de transactions.
      </p>
    </div>
  )
}

const LANGS = ['Fra', 'Fon', 'Eng'] as const
type Lang = typeof LANGS[number]

interface NotifState {
  achats:  boolean
  reseau:  boolean
  cercles: boolean
}

// FAQ content moved to lib/faq/content.ts — source unique de vérité

export default function ProfileSettings({ whatsappNumber, hasPinSet, isMerchant }: { whatsappNumber?: string; hasPinSet?: boolean; isMerchant?: boolean }) {
  const [lang, setLang] = useState<Lang>('Fra')
  const [notifs, setNotifs] = useState<NotifState>({ achats: true, reseau: true, cercles: false })
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null)
  const [linkingGoogle, setLinkingGoogle] = useState(false)

  // PIN state
  const [showPinForm, setShowPinForm] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gf_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.lang)   setLang(parsed.lang)
        if (parsed.notifs) setNotifs(parsed.notifs)
      }
    } catch {}

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const identities = data.user?.identities ?? []
      setGoogleLinked(identities.some(i => i.provider === 'google'))
    })
  }, [])

  function saveLang(l: Lang) {
    setLang(l)
    persist({ lang: l, notifs })
  }

  function toggleNotif(key: keyof NotifState) {
    const next = { ...notifs, [key]: !notifs[key] }
    setNotifs(next)
    persist({ lang, notifs: next })
  }

  function persist(state: { lang: Lang; notifs: NotifState }) {
    try { localStorage.setItem('gf_settings', JSON.stringify(state)) } catch {}
  }

  async function linkGoogle() {
    setLinkingGoogle(true)
    const supabase = createClient()
    await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setLinkingGoogle(false)
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(newPin)) { toast.error('Le nouveau PIN doit contenir 6 chiffres'); return }
    if (newPin !== newPinConfirm) { toast.error('Les codes PIN ne correspondent pas'); return }
    if (hasPinSet && !oldPin) { toast.error('Entrez votre ancien code PIN'); return }

    setPinLoading(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin: oldPin || undefined, newPin }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      toast.success(data.message)
      setShowPinForm(false)
      setOldPin(''); setNewPin(''); setNewPinConfirm('')
    } finally {
      setPinLoading(false)
    }
  }

  const wa = whatsappNumber ?? '22997025083'

  return (
    <div className="space-y-3">
      {/* Paramètres */}
      <div className="card space-y-4">
        {/* Langue */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-gray-900">Langue</p>
            <p className="text-xs text-gray-400">Français</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {LANGS.map(l => (
              <button
                key={l}
                onClick={() => saveLang(l)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  lang === l
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Notifications */}
        {(
          [
            { key: 'achats',  label: 'Notifications achats' },
            { key: 'reseau',  label: 'Notifications communauté' },
            { key: 'cercles', label: 'Notifications Cercles' },
          ] as Array<{ key: keyof NotifState; label: string }>
        ).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <p className="font-medium text-sm text-gray-900">{label}</p>
            <button
              onClick={() => toggleNotif(key)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                notifs[key] ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  notifs[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Sécurité — PIN */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Sécurité</p>
          {!showPinForm && (
            <button
              onClick={() => setShowPinForm(true)}
              className="text-xs text-brand-600 font-semibold hover:text-brand-700"
            >
              {hasPinSet ? 'Modifier le PIN' : 'Définir un PIN'}
            </button>
          )}
        </div>

        {/* Statut PIN */}
        {!showPinForm && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${hasPinSet ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <span className="text-lg">{hasPinSet ? '🔐' : '⚠️'}</span>
            <div>
              <p className={`text-sm font-medium ${hasPinSet ? 'text-green-800' : 'text-amber-800'}`}>
                {hasPinSet ? 'Code PIN actif' : 'Aucun code PIN défini'}
              </p>
              <p className={`text-xs mt-0.5 ${hasPinSet ? 'text-green-600' : 'text-amber-700'}`}>
                {hasPinSet
                  ? 'Vos paiements wallet GreenFlame sont sécurisés'
                  : 'Définissez un PIN pour payer avec votre wallet GreenFlame'}
              </p>
            </div>
          </div>
        )}

        {/* Formulaire PIN */}
        {showPinForm && (
          <form onSubmit={handleChangePin} className="space-y-3">
            <p className="text-sm text-gray-600">
              {hasPinSet ? 'Changez votre code PIN de paiement (6 chiffres).' : 'Créez votre code PIN de paiement (6 chiffres).'}
            </p>

            {hasPinSet && (
              <div>
                <label className="label">Ancien code PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={oldPin}
                  onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="input text-center text-xl tracking-widest font-bold"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="label">Nouveau code PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="input text-center text-xl tracking-widest font-bold"
                autoFocus={!hasPinSet}
              />
            </div>

            <div>
              <label className="label">Confirmer le nouveau PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPinConfirm}
                onChange={e => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className={`input text-center text-xl tracking-widest font-bold ${newPinConfirm && newPin !== newPinConfirm ? 'border-red-300 bg-red-50' : ''}`}
              />
              {newPinConfirm && newPin !== newPinConfirm && (
                <p className="text-xs text-red-500 mt-1">Les codes ne correspondent pas</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowPinForm(false); setOldPin(''); setNewPin(''); setNewPinConfirm('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pinLoading || newPin.length < 6 || newPin !== newPinConfirm || (hasPinSet ? oldPin.length < 6 : false)}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {pinLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Compte */}
      {googleLinked !== null && (
        <div className="card space-y-3">
          <p className="font-semibold text-gray-900">Connexion</p>
          {googleLinked ? (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="text-lg">✓</span>
              <div>
                <p className="text-sm font-medium text-green-800">Compte Google lié</p>
                <p className="text-xs text-green-600">Vous pouvez vous connecter avec Google ou votre téléphone</p>
              </div>
            </div>
          ) : (
            <button
              onClick={linkGoogle}
              disabled={linkingGoogle}
              className="flex items-center justify-center gap-2 w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {linkingGoogle ? 'Redirection…' : 'Lier mon compte Google'}
            </button>
          )}
        </div>
      )}

      {/* Offres marchands */}
      <div className="card space-y-3">
        <div>
          <p className="font-semibold text-gray-900">Offres marchands</p>
          <p className="text-xs text-gray-400 mt-0.5">Gérez les notifications promotionnelles par boutique</p>
        </div>
        <PromoOptOutPanel />
      </div>

      {/* Support */}
      <div className="card space-y-3">
        <p className="font-semibold text-gray-900">Support</p>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            <span>💬</span> WhatsApp
          </a>
          <Link
            href="/faq"
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold py-3 rounded-xl transition-colors text-sm border border-brand-200"
          >
            <span>📋</span> FAQ
          </Link>
        </div>
      </div>
    </div>
  )
}
