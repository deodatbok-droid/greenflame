'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/providers/LocaleProvider'

interface Props {
  userName: string
}

export default function OnboardingFlow({ userName }: Props) {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const { t } = useLocale()

  const STEPS = [
    {
      emoji: '🔥',
      bg: 'from-brand-700 to-brand-900',
      title: t('onboarding.step1Title'),
      subtitle: t('onboarding.step1Subtitle'),
      body: t('onboarding.step1Body'),
      cta: t('onboarding.continue'),
    },
    {
      emoji: '💚',
      bg: 'from-green-700 to-brand-800',
      title: t('onboarding.step2Title'),
      subtitle: t('onboarding.step2Subtitle'),
      body: t('onboarding.step2Body'),
      cta: t('onboarding.continue'),
      visual: [
        { label: t('onboarding.step2VisualPay'),      value: '5 000 FCFA', color: 'text-white' },
        { label: t('onboarding.step2VisualCashback'), value: '+75 FCFA',   color: 'text-green-300' },
      ],
    },
    {
      emoji: '🌐',
      bg: 'from-indigo-700 to-brand-800',
      title: t('onboarding.step3Title'),
      subtitle: t('onboarding.step3Subtitle'),
      body: t('onboarding.step3Body'),
      cta: t('onboarding.continue'),
    },
    {
      emoji: '🏪',
      bg: 'from-amber-700 to-brand-800',
      title: t('onboarding.step4Title'),
      subtitle: t('onboarding.step4Subtitle'),
      body: t('onboarding.step4Body'),
      cta: t('onboarding.start'),
      last: true,
    },
  ]

  const current = STEPS[step]

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      fetch('/api/profile/onboarding-done', { method: 'POST' }).catch(() => {})
      router.push('/dashboard')
    }
  }

  function skip() {
    fetch('/api/profile/onboarding-done', { method: 'POST' }).catch(() => {})
    router.push('/dashboard')
  }

  const firstName = userName ? ' ' + userName.split(' ')[0] : ''

  return (
    <div className={`min-h-screen bg-gradient-to-br ${current.bg} flex flex-col`}>

      {/* Skip */}
      <div className="flex justify-end p-4 pt-10">
        {!current.last && (
          <button onClick={skip} className="text-white/60 text-sm hover:text-white transition-colors">
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      {/* Indicateurs de progression */}
      <div className="flex justify-center gap-2 px-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-white' : i < step ? 'w-4 bg-white/60' : 'w-4 bg-white/25'
            }`}
          />
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center">

        {/* Emoji principal */}
        <div className="text-7xl mb-6 animate-bounce" style={{ animationDuration: '2s' }}>
          {current.emoji}
        </div>

        {/* Titre */}
        <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
          {step === 0 ? `${t('onboarding.hello')}${firstName} !` : current.title}
        </h1>
        <p className="text-white/70 text-sm mb-6">{current.subtitle}</p>

        {/* Visuel optionnel (étape cashback) */}
        {current.visual && (
          <div className="w-full max-w-xs mb-6 bg-white/10 rounded-2xl p-5 border border-white/20">
            {current.visual.map((v, i) => (
              <div key={i} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-white/20' : ''}`}>
                <span className="text-white/70 text-sm">{v.label}</span>
                <span className={`font-bold text-lg ${v.color}`}>{v.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Corps */}
        <p className="text-white/80 text-base leading-relaxed max-w-sm">
          {current.body}
        </p>
      </div>

      {/* Bouton CTA */}
      <div className="px-8 pb-12">
        <button
          onClick={next}
          className="w-full bg-white text-brand-800 font-bold py-4 rounded-2xl text-base hover:bg-brand-50 transition-colors active:scale-95 shadow-lg"
        >
          {current.cta}
        </button>
      </div>
    </div>
  )
}
