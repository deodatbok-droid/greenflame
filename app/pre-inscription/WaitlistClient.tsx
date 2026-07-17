'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  referralCode: string | null
  referrerName: string | null
  initialCount: number
}

interface FormState {
  first_name: string
  last_name:  string
  email:      string
  whatsapp:   string
  role:       'user' | 'merchant'
}

interface SuccessState {
  referral_url: string
  first_name:   string
  position:     number
}

export default function WaitlistClient({ referralCode, referrerName, initialCount }: Props) {
  const [form, setForm] = useState<FormState>({
    first_name: '', last_name: '', email: '', whatsapp: '', role: 'user',
  })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState<SuccessState | null>(null)
  const [copied,   setCopied]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, referred_by_code: referralCode }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess({
          referral_url: data.referral_url,
          first_name:   data.first_name,
          position:     initialCount + 1,
        })
      } else {
        setError(data.error ?? 'Une erreur est survenue.')
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!success) return
    await navigator.clipboard.writeText(success.referral_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function shareWhatsApp() {
    if (!success) return
    const msg =
      `🔥 J'ai réservé ma place sur GreenFlame — le marché communautaire qui te rembourse une partie de chaque achat.\n\n` +
      `Rejoins la liste d'attente avant le lancement officiel :\n${success.referral_url}\n\nBénin 🇧🇯`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const field = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-9 h-9">
              <Image src="/logo-transparent.png" alt="GreenFlame" fill className="object-contain" />
            </div>
            <span className="text-green-700 font-bold text-base">GreenFlame</span>
          </Link>
          <Link href="/login" className="text-xs text-gray-500 hover:text-green-700 transition-colors font-medium">
            Déjà membre →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div
        className="pt-14"
        style={{ background: 'linear-gradient(160deg, #14532d 0%, #166534 60%, #15803d 100%)' }}
      >
        <div className="max-w-lg mx-auto px-4 pt-10 pb-16 text-center text-white">
          {referrerName && (
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
              <span>👋</span>
              <span>{referrerName} vous invite à rejoindre GreenFlame</span>
            </div>
          )}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Le marché qui vous gratifie<br />
            <span style={{ color: '#fbbf24' }}>à chaque achat</span>
          </h1>
          <p className="text-green-200 mt-3 text-sm leading-relaxed max-w-xs mx-auto">
            Réservez votre place avant le lancement officiel de GreenFlame au Bénin.
            Cashback automatique, revenus communautaires, boutique digitale.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fcd34d' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#fbbf24', animation: 'pulse 2s infinite' }} />
            {initialCount > 0
              ? `${initialCount.toLocaleString('fr-FR')} personnes déjà inscrites`
              : 'Lancement imminent — rejoignez en premier'}
          </div>
        </div>
      </div>

      {/* ── Bande avantages ── */}
      <div style={{ background: '#052e16', borderTop: '1px solid rgba(22,101,52,0.4)' }}>
        <div className="max-w-lg mx-auto px-4 py-4 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: '💚', title: 'Cashback',    desc: 'Sur chaque achat' },
            { icon: '🌱', title: 'Communauté',  desc: 'Revenus passifs' },
            { icon: '🏪', title: 'Boutique',    desc: 'Digitale gratuite' },
          ].map(b => (
            <div key={b.title} className="py-2">
              <span className="text-xl">{b.icon}</span>
              <p className="text-white text-xs font-bold mt-1">{b.title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#4ade80' }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div className="max-w-lg mx-auto px-4 pb-16">

        {!success ? (
          /* ── Formulaire ── */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 -mt-6 relative z-10 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">Rejoindre la liste d&apos;attente</h2>
            <p className="text-sm text-gray-400 mb-5">
              {referrerName
                ? `Invité(e) par ${referrerName} · Inscription gratuite`
                : 'Inscription gratuite · Notification WhatsApp au lancement'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Prénoms *</label>
                  <input
                    type="text" placeholder="Jean-Paul" required
                    value={form.first_name}
                    onChange={e => field('first_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nom *</label>
                  <input
                    type="text" placeholder="KOFFI" required
                    value={form.last_name}
                    onChange={e => field('last_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp *</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-sm text-gray-500 whitespace-nowrap">
                    🇧🇯 +229
                  </span>
                  <input
                    type="tel" placeholder="97 00 00 00" required
                    value={form.whatsapp}
                    onChange={e => field('whatsapp', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-r-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Email <span className="text-gray-400 font-normal">(facultatif)</span>
                </label>
                <input
                  type="email" placeholder="jean@email.com"
                  value={form.email}
                  onChange={e => field('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Je serai *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'user',     icon: '🛒', label: 'Acheteur',  desc: 'Je veux du cashback' },
                    { value: 'merchant', icon: '🏪', label: 'Marchand',  desc: 'Je vends des produits' },
                  ].map(opt => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => field('role', opt.value)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center ${
                        form.role === opt.value
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl mb-1">{opt.icon}</span>
                      <span className={`text-sm font-bold ${form.role === opt.value ? 'text-green-700' : 'text-gray-700'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
                style={{
                  background:   loading ? '#9ca3af' : '#15803d',
                  boxShadow:    '0 4px 14px rgba(21,128,61,0.3)',
                  cursor:       loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Inscription en cours…' : '🔥 Réserver ma place gratuitement'}
              </button>

              <p className="text-[10px] text-center text-gray-400">
                Aucun paiement requis. Vous serez notifié(e) sur WhatsApp dès le lancement officiel.
              </p>
            </form>
          </div>

        ) : (
          /* ── Écran succès ── */
          <div className="pt-6 space-y-4">

            {/* Carte de bienvenue */}
            <div
              className="rounded-2xl p-6 text-white text-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}
            >
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-extrabold">Bravo, {success.first_name} !</h2>
              <p className="text-green-200 text-sm mt-1">
                Vous êtes sur la liste d&apos;attente GreenFlame.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm font-semibold">
                <span>🏆</span>
                <span>Inscrit(e) n°{success.position.toLocaleString('fr-FR')}</span>
              </div>
            </div>

            {/* Carte lien de parrainage */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔗</span>
                <h3 className="font-bold text-gray-900 text-sm">Votre lien de parrainage</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Partagez ce lien — chaque inscrit via vous sera dans votre arborescence au lancement.
              </p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 font-mono text-xs text-gray-600 break-all mb-3">
                {success.referral_url}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: copied ? '#dcfce7' : '#f3f4f6',
                    color:      copied ? '#15803d' : '#374151',
                  }}
                >
                  {copied ? '✅ Copié !' : '📋 Copier'}
                </button>
                <button
                  onClick={shareWhatsApp}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: '#25D366' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Prochaines étapes */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 text-sm mb-3">📅 Ce qui se passe ensuite</h3>
              <div className="space-y-3">
                {[
                  { icon: '📱', text: 'Vous recevrez une notification WhatsApp au lancement officiel' },
                  { icon: '🌳', text: 'Votre arborescence sera construite à partir de vos parrainages ici' },
                  { icon: '💰', text: 'Dès le lancement, vos achats et ceux de votre communauté génèrent du cashback' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">{step.icon}</span>
                    <p className="text-sm text-amber-800">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/" className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-green-700 transition-colors py-2">
              ← Retour à l&apos;accueil
            </Link>
          </div>
        )}

        {/* ── Garanties (formulaire uniquement) ── */}
        {!success && (
          <div className="mt-6 flex items-center justify-center gap-6 text-center">
            {[
              { icon: '🔒', text: 'Données protégées' },
              { icon: '🆓', text: 'Gratuit' },
              { icon: '📱', text: 'WhatsApp' },
            ].map(item => (
              <div key={item.text} className="flex flex-col items-center gap-1">
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] text-gray-400">{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: '#052e16' }} className="py-6 text-center px-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="relative w-5 h-5 opacity-70">
            <Image src="/logo-transparent.png" alt="" fill className="object-contain" />
          </div>
          <span className="text-green-300 font-semibold text-sm">GreenFlame</span>
        </div>
        <p className="text-green-500 text-xs">Commerce communautaire · Cotonou, Bénin 🇧🇯</p>
        <p className="text-green-600 text-xs mt-1">greenflameafrica.com</p>
      </div>
    </div>
  )
}
