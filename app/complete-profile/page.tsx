'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'
import { useDemo } from '@/lib/demo/DemoContext'
import { DEMO_PROFILE } from '@/lib/demo/data'

function CompleteProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useLocale()
  const { isDemo, markStepComplete } = useDemo()

  const refFromUrl = searchParams.get('ref') ?? ''
  // Lien de retour après création de profil (ex. invitation tontine) — sinon
  // comportement par défaut (dashboard).
  const next = searchParams.get('next') ?? ''

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState(refFromUrl)
  const [showReferralInput, setShowReferralInput] = useState(false)
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  // true = user authenticated via phone OTP, false = Google OAuth
  const [isPhoneUser, setIsPhoneUser] = useState(false)

  // Verify auth + resolve inviter name
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(next ? `/login?next=${encodeURIComponent(next)}` : '/login'); return }

      // If they already have a profile, send them to their intended destination
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) { router.replace(next || '/dashboard'); return }

      // Detect auth method
      if (user.phone) {
        setIsPhoneUser(true)
        setPhone(user.phone)
      } else {
        setEmail(user.email ?? '')
      }
      setChecking(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve inviter name from referral code
  useEffect(() => {
    if (!refFromUrl) return
    fetch(`/api/referral?code=${encodeURIComponent(refFromUrl)}`)
      .then(r => r.json())
      .then(d => { if (d.valid) setInviterName(d.name) })
  }, [refFromUrl])

  function normalizePhone(raw: string): string {
    if (raw.startsWith('+')) return raw
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('229')) return '+' + digits
    if (digits.startsWith('0')) return '+229' + digits.slice(1)
    return '+229' + digits
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error(t('completeProfile.errorName')); return }
    if (!isPhoneUser && !phone.trim()) { toast.error(t('completeProfile.errorPhone')); return }
    if (!/^\d{6}$/.test(pin)) { toast.error(t('completeProfile.errorPinFormat')); return }
    if (pin !== pinConfirm) { toast.error(t('completeProfile.errorPinMatch')); return }

    setLoading(true)
    const newReferralCode = 'GF-' + Math.random().toString(36).slice(2, 10).toUpperCase()

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: normalizePhone(phone),
        email: email.trim() || null,
        referralCode: referralCode.trim() || null,
        newReferralCode,
        pin,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok && !data.alreadyExists) {
      toast.error(data.error ?? t('completeProfile.errorCreate'))
      return
    }

    toast.success(t('completeProfile.successToast'))
    if (isDemo) markStepComplete('profil')
    router.push(next || '/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const isFromReferralLink = !!refFromUrl

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center p-6">
      {/* Photo de bienvenue + Logo */}
      <div className="mb-8 text-center">
        <div className="relative w-32 h-32 mx-auto mb-5 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/30">
          <img
            src="/images/Complete%20profile.png"
            alt="GreenFlame"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1.5 right-1.5 w-9 h-9 bg-white rounded-xl shadow-lg flex items-center justify-center">
            <Logo size={22} variant="onLight" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white">GreenFlame</h1>
        <p className="text-brand-100 mt-1 text-sm">{t('completeProfile.tagline')}</p>
      </div>

      <div className="card w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Remplissage démo */}
          {isDemo && (
            <button
              type="button"
              onClick={() => {
                setFullName(DEMO_PROFILE.fullName)
                setEmail(DEMO_PROFILE.email)
                setPin(DEMO_PROFILE.pin)
                setPinConfirm(DEMO_PROFILE.pinConfirm)
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              🎬 ✦ Remplir automatiquement
            </button>
          )}

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('completeProfile.yourProfile')}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {isPhoneUser
                ? <>{t('completeProfile.phoneAccount')} · <span className="font-medium text-brand-600">+229 {phone}</span></>
                : <>{t('completeProfile.googleAccount')} · <span className="font-medium text-brand-600 truncate">{email}</span></>
              }
            </p>
          </div>

          {/* Nom complet */}
          <div>
            <label className="label">{t('register.nameLabel')}</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ex: Kofi Mensah"
              className="input"
              autoFocus
              required
            />
          </div>

          {/* Téléphone */}
          {isPhoneUser ? (
            <div>
              <label className="label">
                {t('common.phone')} <span className="text-gray-400 text-xs">{t('completeProfile.phoneVerified')}</span>
              </label>
              <PhoneInput value={phone} onChange={() => {}} disabled />
            </div>
          ) : (
            <div>
              <label className="label">{t('common.phone')}</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="97 00 00 00"
              />
            </div>
          )}

          {/* Email */}
          {isPhoneUser ? (
            <div>
              <label className="label">
                {t('common.email')} <span className="text-gray-400 text-xs">{t('completeProfile.emailOptionalHint')}</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="input"
              />
            </div>
          ) : (
            <div>
              <label className="label">
                {t('common.email')} <span className="text-gray-400 text-xs">{t('completeProfile.emailFromGoogle')}</span>
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="input bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          )}

          {/* Code PIN */}
          <div>
            <label className="label">
              {t('completeProfile.pinLabel')} <span className="text-gray-400 text-xs">{t('completeProfile.pinHint')}</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="input text-center text-2xl tracking-widest font-bold"
              required
            />
          </div>
          <div>
            <label className="label">{t('completeProfile.pinConfirmLabel')}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirm}
              onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className={`input text-center text-2xl tracking-widest font-bold ${pinConfirm && pin !== pinConfirm ? 'border-red-300 bg-red-50' : ''}`}
              required
            />
            {pinConfirm && pin !== pinConfirm && (
              <p className="text-xs text-red-500 mt-1">{t('completeProfile.pinMismatch')}</p>
            )}
          </div>

          {/* Parrainage */}
          {isFromReferralLink ? (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-brand-700 text-sm font-semibold">
                  {inviterName ? `${t('completeProfile.invitedBy')} ${inviterName}` : t('completeProfile.referralActive')}
                </p>
                <p className="text-brand-500 text-xs">{t('completeProfile.referralAutomatic')}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReferralInput(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🤝</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t('completeProfile.haveReferral')}</p>
                    {!showReferralInput && referralCode && (
                      <p className="text-xs text-brand-600 font-mono mt-0.5">{referralCode}</p>
                    )}
                    {!showReferralInput && !referralCode && (
                      <p className="text-xs text-gray-400">{t('completeProfile.referralHint')}</p>
                    )}
                  </div>
                </div>
                <span className={`text-gray-400 text-lg transition-transform ${showReferralInput ? 'rotate-90' : ''}`}>›</span>
              </button>
              {showReferralInput && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-dashed border-gray-200 bg-gray-50/50">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={e => {
                      const v = e.target.value
                      // Ne pas forcer uppercase si c'est un numéro de téléphone
                      setReferralCode(/^\d/.test(v) ? v : v.toUpperCase())
                    }}
                    placeholder="Code GF-XXXXXXXX ou numéro Mobile Money"
                    className="input font-mono text-sm"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400">
                    {t('completeProfile.referralEmpty')}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !fullName.trim() || (!isPhoneUser && !phone.trim()) || pin.length < 6 || pin !== pinConfirm}
            className="btn-primary"
          >
            {loading ? t('completeProfile.creating') : t('completeProfile.create')}
          </button>
        </form>
      </div>

      <p className="text-brand-100 text-xs mt-6 text-center">
        {t('completeProfile.freeNote')}
      </p>
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <CompleteProfileForm />
    </Suspense>
  )
}
