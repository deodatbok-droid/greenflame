'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/ui/PhoneInput'
import LangToggle from '@/components/ui/LangToggle'
import { useLocale } from '@/components/providers/LocaleProvider'
import { normalizePhone } from '@/lib/utils/phone'

type Step = 'phone' | 'otp' | 'profile' | 'kyc'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useLocale()

  const referralFromUrl = searchParams.get('ref') ?? ''
  const isFromReferralLink = !!referralFromUrl

  // Lien de retour après inscription (ex. invitation tontine) — sinon
  // comportement par défaut (onboarding).
  const next = searchParams.get('next') ?? ''

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [referralCode, setReferralCode] = useState(referralFromUrl)
  const [showReferralInput, setShowReferralInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // KYC state
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [kycLoading, setKycLoading] = useState(false)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!referralFromUrl) return
    // Lookup via API (service client cote serveur, bypass RLS)
    fetch(`/api/referral?code=${encodeURIComponent(referralFromUrl)}`)
      .then(r => r.json())
      .then(d => { if (d.valid) setInviterName(d.name) })
  }, [referralFromUrl])

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { toast.error('Numéro requis'); return }
    setLoading(true)
    const normalized = normalizePhone(phone)
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { channel: 'sms' },
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Code envoyé au ${normalized}`)
    setStep('otp')
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length < 6) { toast.error('Code à 6 chiffres requis'); return }
    setLoading(true)
    const normalized = normalizePhone(phone)
    const { error } = await supabase.auth.verifyOtp({
      phone: normalized, token: otp, type: 'sms',
    })
    setLoading(false)
    if (error) { toast.error('Code incorrect ou expiré'); return }
    setStep('profile')
  }

  async function handleCompleteProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Votre nom est requis'); return }
    if (!/^\d{6}$/.test(pin)) { toast.error('Le code PIN doit contenir exactement 6 chiffres'); return }
    if (pin !== pinConfirm) { toast.error('Les codes PIN ne correspondent pas'); return }
    setLoading(true)

    const newReferralCode = 'GF-' + Math.random().toString(36).slice(2, 10).toUpperCase()

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
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
      toast.error(data.error ?? 'Erreur lors de la création du profil')
      return
    }

    // Recuperer l'ID auth pour l'upload KYC
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    setStep('kyc')
  }

  function handleFileSelect(side: 'front' | 'back', file: File | null) {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (side === 'front') { setFrontFile(file); setFrontPreview(url) }
    else { setBackFile(file); setBackPreview(url) }
  }

  async function handleKycSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!frontFile) { toast.error('La photo recto est requise'); return }
    if (!userId) { toast.error('Session expirée, reconnectez-vous'); return }

    setKycLoading(true)

    try {
      const ext = (f: File) => f.name.split('.').pop() ?? 'jpg'

      // Upload recto
      const frontPath = `${userId}/front.${ext(frontFile)}`
      const { error: e1 } = await supabase.storage
        .from('kyc-documents')
        .upload(frontPath, frontFile, { upsert: true })
      if (e1) throw new Error(e1.message)

      // Upload verso (optionnel)
      let backPath: string | null = null
      if (backFile) {
        backPath = `${userId}/back.${ext(backFile)}`
        const { error: e2 } = await supabase.storage
          .from('kyc-documents')
          .upload(backPath, backFile, { upsert: true })
        if (e2) throw new Error(e2.message)
      }

      // Enregistrement de la soumission
      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontPath, backPath }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erreur KYC')
      }

      toast.success('Documents soumis ! Vérification en cours.')
      router.push(next || '/onboarding')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur upload')
    } finally {
      setKycLoading(false)
    }
  }

  async function skipKyc() {
    router.push(next || '/onboarding')
    router.refresh()
  }

  const stepIndex: Record<Step, number> = { phone: 0, otp: 1, profile: 2, kyc: 3 }
  const steps: Step[] = ['phone', 'otp', 'profile', 'kyc']

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 left-4">
        <Link href="/" className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {t('nav.home')}
        </Link>
      </div>
      <div className="absolute top-4 right-4">
        <LangToggle className="text-white/80" />
      </div>
      <div className="mb-8 text-center">
        <Logo size={72} className="w-[72px] h-[72px] mx-auto mb-4 drop-shadow-xl" />
        <h1 className="text-3xl font-bold text-white">GreenFlame</h1>
        <p className="text-brand-100 mt-1 text-sm">{t('register.tagline')}</p>
      </div>

      <div className="card w-full max-w-sm">
        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${stepIndex[step] >= i ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* ETAPE 1 : Téléphone */}
        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">{t('register.phoneTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('register.phoneSubtitle')}</p>
            </div>
            <div>
              <label className="label">{t('register.phoneLabel')}</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="01 97 00 00 00"
                autoFocus
              />
            </div>
            {/* ── PARRAINAGE ── */}
            {isFromReferralLink ? (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="text-brand-700 text-sm font-semibold">
                    {inviterName ? `${t('register.invitedBy')} ${inviterName}` : t('register.referralActive')}
                  </p>
                  <p className="text-brand-500 text-xs">{t('register.referralAutomatic')}</p>
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
                      <p className="text-sm font-semibold text-gray-800">{t('register.haveReferral')}</p>
                      {!showReferralInput && referralCode && (
                        <p className="text-xs text-brand-600 font-mono mt-0.5">{referralCode}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform ${showReferralInput ? 'rotate-90' : ''}`}>›</span>
                </button>
                {showReferralInput && (
                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-dashed border-gray-200 bg-gray-50/50">
                    <label className="label">{t('register.referralLabel')}</label>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={e => {
                        const v = e.target.value
                        setReferralCode(/^\d/.test(v) ? v : v.toUpperCase())
                      }}
                      placeholder={t('register.referralPlaceholder')}
                      className="input font-mono text-sm"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t('common.sending') : t('register.sendCode')}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400 font-medium">{t('common.or')}</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              type="button"
              onClick={async () => {
                setLoading(true)
                const ref = referralCode.trim()
                const callbackParams = new URLSearchParams()
                if (ref) callbackParams.set('ref', ref)
                if (next) callbackParams.set('next', next)
                const qs = callbackParams.toString()
                const callbackUrl = `${window.location.origin}/auth/callback${qs ? `?${qs}` : ''}`
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: callbackUrl },
                })
                if (error) { toast.error(error.message); setLoading(false) }
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('login.continueGoogle')}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t('register.hasAccount')}{' '}
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
                className="text-brand-600 font-semibold"
              >
                {t('register.signIn')}
              </Link>
            </p>
          </form>
        )}

        {/* ETAPE 2 : Code OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <button type="button" onClick={() => setStep('phone')} className="text-brand-600 text-sm font-medium mb-3">
                ← {t('common.back')}
              </button>
              <h2 className="text-xl font-bold">{t('register.otpTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {t('register.otpSubtitle')} — <strong>{normalizePhone(phone)}</strong>
              </p>
            </div>
            <div>
              <label className="label">{t('register.codeLabel')}</label>
              <input
                type="text" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input text-center text-2xl font-bold tracking-widest"
                autoFocus inputMode="numeric" maxLength={6}
              />
            </div>
            <button type="submit" disabled={loading || otp.length < 6} className="btn-primary">
              {loading ? t('common.verifying') : t('register.verify')}
            </button>
          </form>
        )}

        {/* ETAPE 3 : Profil */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteProfile} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">{t('register.profileTitle')}</h2>
            </div>
            <div>
              <label className="label">{t('register.nameLabel')}</label>
              <input
                type="text" value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={t('register.namePlaceholder')}
                className="input" autoFocus
              />
            </div>
            <div>
              <label className="label">{t('register.emailLabel')}</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="input"
              />
            </div>
            {/* Parrainage — confirmation ou saisie si oublié en étape 1 */}
            {(isFromReferralLink || referralCode) ? (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-semibold text-brand-700">{inviterName ?? 'Membre GreenFlame'}</p>
                  <p className="text-xs text-brand-400 font-mono mt-0.5">{referralCode}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤝</span>
                  <p className="text-sm font-semibold text-amber-800">{t('register.haveReferral')}</p>
                </div>
                <input
                  type="text" value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  placeholder={t('register.referralPlaceholder')}
                  className="input font-mono"
                />
              </div>
            )}

            {/* Code PIN */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <p className="text-sm font-semibold text-gray-800">{t('register.pinLabel')}</p>
              </div>
              <p className="text-xs text-gray-500">{t('register.pinHint')}</p>
              <div>
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
                <label className="label">{t('register.pinConfirmLabel')}</label>
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
              </div>
            </div>

            <button type="submit" disabled={loading || !fullName.trim() || pin.length < 6 || pin !== pinConfirm} className="btn-primary">
              {loading ? t('register.creating') : t('register.createAccount')}
            </button>
          </form>
        )}

        {/* ETAPE 4 : KYC */}
        {step === 'kyc' && (
          <form onSubmit={handleKycSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">{t('register.kycTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('register.kycSubtitle')}</p>
            </div>

            {/* Recto */}
            <div>
              <label className="label">{t('register.kycFront')} <span className="text-red-500">*</span></label>
              <label className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${frontPreview ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-400'}`}>
                {frontPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frontPreview} alt="Recto" className="max-h-32 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="py-3">
                    <p className="text-3xl mb-1">📷</p>
                    <p className="text-sm text-gray-500">{t('register.kycAddPhoto')}</p>
                  </div>
                )}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileSelect('front', e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {/* Verso */}
            <div>
              <label className="label">{t('register.kycBack')}</label>
              <label className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${backPreview ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-400'}`}>
                {backPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={backPreview} alt="Verso" className="max-h-32 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="py-3">
                    <p className="text-3xl mb-1">📋</p>
                    <p className="text-sm text-gray-500">{t('register.kycAddPhoto')}</p>
                  </div>
                )}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileSelect('back', e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <button type="submit" disabled={kycLoading || !frontFile} className="btn-primary">
              {kycLoading ? t('register.kycSubmitting') : t('register.kycSubmit')}
            </button>
            <button type="button" onClick={skipKyc} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
              {t('register.kycSkip')} — {t('register.kycSkipHint')}
            </button>
          </form>
        )}
      </div>

      <p className="text-brand-100 text-xs mt-6 text-center">
        {t('register.tagline')}
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
