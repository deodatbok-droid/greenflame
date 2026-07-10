'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/ui/PhoneInput'
import LangToggle from '@/components/ui/LangToggle'
import { useLocale } from '@/components/providers/LocaleProvider'
import { normalizePhone } from '@/lib/utils/phone'

type Step = 'phone' | 'otp'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useLocale()

  // Lien de retour après connexion (ex. invitation tontine) — sinon
  // comportement par défaut (dashboard ou complete-profile).
  const next = searchParams.get('next') ?? ''

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { toast.error('Entrez votre numéro de téléphone'); return }
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
    if (otp.length < 6) { toast.error('Entrez le code à 6 chiffres'); return }
    setLoading(true)
    const normalized = normalizePhone(phone)

    const { error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp,
      type: 'sms',
    })

    if (error) { setLoading(false); toast.error('Code incorrect ou expiré'); return }

    // Vérifier si le profil est complet (nom manquant = nouvel utilisateur)
    // Note : on reste en loading=true pendant cette vérification pour éviter le clignotement
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.full_name) {
        router.push(next ? `/complete-profile?next=${encodeURIComponent(next)}` : '/complete-profile')
        return
      }
    }

    toast.success('Connexion réussie !')
    router.push(next || '/dashboard')
    router.refresh()
  }

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
        <p className="text-brand-100 mt-1 text-sm">{t('login.tagline')}</p>
      </div>

      <div className="card w-full max-w-sm">
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('login.title')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('login.subtitle')}</p>
            </div>
            <div>
              <label className="label">{t('login.phoneLabel')}</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="01 97 00 00 00"
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t('common.sending') : t('login.sendCode')}
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
                const callbackUrl = next
                  ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
                  : `${window.location.origin}/auth/callback`
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
              {t('login.noAccount')}{' '}
              <Link
                href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
                className="text-brand-600 font-semibold"
              >
                {t('login.signUp')}
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-brand-600 text-sm font-medium mb-3 flex items-center gap-1"
              >
                {t('login.changeNumber')}
              </button>
              <h2 className="text-xl font-bold text-gray-900">{t('login.verificationTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {t('login.codeSentTo')} <strong>{normalizePhone(phone)}</strong>
              </p>
            </div>
            <div>
              <label className="label">{t('login.codeLabel')}</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input text-center text-2xl font-bold tracking-widest"
                autoFocus
                inputMode="numeric"
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={loading || otp.length < 6} className="btn-primary">
              {loading ? t('common.verifying') : t('login.verify')}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp('') }}
              className="text-center text-sm text-gray-500 w-full"
            >
              {t('login.resendCode')}
            </button>
          </form>
        )}
      </div>

      <p className="text-brand-100 text-xs mt-6 text-center">
        En vous connectant, vous acceptez nos{' '}
        <Link href="/terms" className="underline hover:text-white">Conditions d&apos;utilisation</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
