'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from '@/components/providers/LocaleProvider'
import LangToggle from '@/components/ui/LangToggle'

export default function LandingPage({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [showNetworks, setShowNetworks] = useState(false)
  const { t } = useLocale()

  useEffect(() => {
    // Afficher le bandeau PWA si l'événement d'installation est disponible
    const checkInstall = () => {
      if (typeof window !== 'undefined' && window.__gf_pwa_prompt) {
        setShowInstall(true)
      }
    }
    // Vérifier immédiatement puis à intervalles (l'événement peut arriver après le rendu)
    checkInstall()
    const interval = setInterval(checkInstall, 1000)
    // Aussi écouter l'event directement ici pour les cas où SW s'enregistre vite
    const handler = () => setTimeout(checkInstall, 200)
    window.addEventListener('beforeinstallprompt', handler)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (typeof window !== 'undefined' && window.__gf_pwa_install) {
      const accepted = await window.__gf_pwa_install()
      if (accepted) setShowInstall(false)
    }
  }

  const STEPS = [
    { num: '01', title: t('landing.step1Title'), desc: t('landing.step1Desc'), icon: '🛒', color: 'bg-green-600' },
    { num: '02', title: t('landing.step2Title'), desc: t('landing.step2Desc'), icon: '💰', color: 'bg-amber-500' },
    { num: '03', title: t('landing.step3Title'), desc: t('landing.step3Desc'), icon: '🌱', color: 'bg-emerald-600' },
  ]

  const VALUES = [
    { icon: '🔒', title: t('landing.value1Title'), desc: t('landing.value1Desc'), bg: 'bg-green-50',   border: 'border-green-100',   iconBg: 'bg-green-100' },
    { icon: '📡', title: t('landing.value2Title'), desc: t('landing.value2Desc'), bg: 'bg-amber-50',   border: 'border-amber-100',   iconBg: 'bg-amber-100' },
    { icon: '🌍', title: t('landing.value3Title'), desc: t('landing.value3Desc'), bg: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100' },
  ]

  const STATS = [
    { value: t('landing.stat1Value'), label: t('landing.stat1Label') },
    { value: '100%',                  label: t('landing.stat2Label') },
    { value: t('landing.stat3Value'), label: t('landing.stat3Label') },
    { value: t('landing.stat4Value'), label: t('landing.stat4Label') },
  ]

  const BUYER_FEATURES = [
    { icon: '💚', text: t('landing.buyerFeature1') },
    { icon: '🌐', text: t('landing.buyerFeature2') },
    { icon: '📱', text: t('landing.buyerFeature3') },
    { icon: '🔥', text: t('landing.buyerFeature4') },
  ]

  const MERCHANT_FEATURES = [
    { icon: '🏪', text: t('landing.merchantFeature1') },
    { icon: '📲', text: t('landing.merchantFeature2') },
    { icon: '🔄', text: t('landing.merchantFeature3') },
    { icon: '📊', text: t('landing.merchantFeature4') },
  ]

  const FEE_CODES = [
    { code: 'C-3',  label: t('landing.feeCode1Label'), desc: t('landing.feeCode1Desc') },
    { code: 'C-5',  label: t('landing.feeCode2Label'), desc: t('landing.feeCode2Desc') },
    { code: 'C-10', label: t('landing.feeCode3Label'), desc: t('landing.feeCode3Desc') },
    { code: 'C-15', label: t('landing.feeCode4Label'), desc: t('landing.feeCode4Desc') },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-[200] bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg">
            <div className="w-10 h-10 rounded-xl flex-shrink-0">
              <Image src="/logo-transparent.png" alt="GreenFlame" width={72} height={72} className="object-contain w-full h-full" priority />
            </div>
            <span className="text-green-700">GreenFlame</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#comment" className="hover:text-green-700 transition-colors">{t('landing.navHow')}</a>
            <a href="#valeurs" className="hover:text-green-700 transition-colors">{t('landing.navWhy')}</a>
            <Link href="/demo" className="hover:text-green-700 transition-colors">{t('landing.navDemo')}</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LangToggle className="text-gray-500" />
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-600 hover:text-green-700 transition-colors">
                  {t('landing.navMyDashboard')}
                </Link>
                <Link href="/register" className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium">
                  {t('landing.navJoin')}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-green-700 transition-colors">
                  {t('common.signIn')}
                </Link>
                <Link href="/register" className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium">
                  {t('landing.navJoin')}
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 text-gray-600" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-4 text-sm">
            <a href="#comment" className="text-gray-600" onClick={() => setMenuOpen(false)}>{t('landing.navHow')}</a>
            <a href="#valeurs" className="text-gray-600" onClick={() => setMenuOpen(false)}>{t('landing.navWhy')}</a>
            <Link href="/demo" className="text-gray-600" onClick={() => setMenuOpen(false)}>{t('landing.navDemo')}</Link>
            <LangToggle className="text-gray-500 self-start" />
            <hr className="border-gray-100" />
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-gray-600">{t('landing.navMyDashboard')}</Link>
                <Link href="/register" className="bg-green-700 text-white px-4 py-2 rounded-lg text-center font-medium">
                  {t('landing.navJoin')}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600">{t('common.signIn')}</Link>
                <Link href="/register" className="bg-green-700 text-white px-4 py-2 rounded-lg text-center font-medium">
                  {t('landing.navJoin')}
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-0 overflow-hidden text-white pointer-events-none">
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/hero.jpg"
            alt={t('landing.heroAlt')}
            fill
            className="object-cover object-center"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-green-900/85 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-green-700/30 via-transparent to-green-900/30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-emerald-400/10 rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 pt-44 pb-20 md:pt-52 md:pb-28 text-center">
          <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-medium px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm">
              {t('landing.heroBadge')}
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight mb-6 mx-auto">
            <span>{t('landing.heroTitle1')}{' '}<span className="text-amber-300">{t('landing.heroTitle2')}</span>{' '}{t('landing.heroTitle3')}</span>
          </h1>

          <p className="text-lg md:text-xl text-green-100 max-w-xl mx-auto mb-10 leading-relaxed">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-base hover:bg-green-50 transition-colors shadow-lg pointer-events-auto">
              {t('landing.heroStart')}
            </Link>
            <Link href="/demo" className="border border-white/40 text-white px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/10 transition-colors pointer-events-auto">
              {t('landing.heroDemo')}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/marketplace" className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-2xl transition-all pointer-events-auto">
              <span>🛍️</span>
              <span>{t('landing.heroMarket')}</span>
              <span className="text-green-300 text-xs">→</span>
            </Link>
            <button onClick={handleInstall} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-green-100 text-sm font-medium px-4 py-2 rounded-2xl transition-all pointer-events-auto">
              <span>📲</span>
              <span>Installer l&apos;app</span>
            </button>
          </div>

          {isLoggedIn && (
            <p className="mt-5 text-green-300 text-sm">
              {t('landing.heroMember')}{' '}
              <Link href="/dashboard" className="text-white font-semibold underline underline-offset-2 hover:text-amber-300 transition-colors pointer-events-auto">
                {t('landing.heroDashboard')}
              </Link>
            </p>
          )}

          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-green-200 relative">
            <div className="absolute -inset-x-8 -inset-y-3 bg-green-900/40 rounded-xl blur-sm -z-10" />
            <span>{t('landing.heroCheck1')}</span>
            <span>{t('landing.heroCheck2')}</span>
            <span>{t('landing.heroCheck3')}</span>
          </div>
        </div>
      </section>

      {/* ── ACHETEURS vs MARCHANDS ── */}
      <section className="py-12 md:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8">

          {/* Acheteurs */}
          <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-8 text-white">
            <div className="text-4xl mb-4">🛍️</div>
            <h3 className="text-2xl font-bold mb-2">{t('landing.buyerTitle')}</h3>
            <p className="text-green-200 text-sm mb-6">{t('landing.buyerSubtitle')}</p>
            <ul className="space-y-3 mb-8">
              {BUYER_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{f.icon}</span>
                  {f.icon === '📱' ? (
                    <div className="flex-1">
                      <button
                        onClick={() => setShowNetworks(!showNetworks)}
                        className="text-green-100 text-sm leading-relaxed hover:text-white transition-colors text-left flex items-center gap-1"
                      >
                        {f.text}
                        <span className="text-green-400 text-xs ml-1">{showNetworks ? '▾' : '▸'}</span>
                      </button>
                      {showNetworks && (
                        <div className="mt-1.5 flex gap-1.5 flex-wrap">
                          {['MTN MoMo', 'Moov Money', 'Celtiis'].map(n => (
                            <span key={n} className="text-[11px] bg-green-800/60 text-green-200 px-2 py-0.5 rounded-full border border-green-700/50">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-green-100 text-sm leading-relaxed">{f.text}</span>
                  )}
                </li>
              ))}
            </ul>
            <Link href="/register" className="inline-block bg-white text-green-700 font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm">
              {t('landing.buyerCta')}
            </Link>
          </div>

          {/* Marchands */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 text-white">
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="text-2xl font-bold mb-2">{t('landing.merchantTitle')}</h3>
            <p className="text-amber-100 text-sm mb-6">{t('landing.merchantSubtitle')}</p>
            <ul className="space-y-3 mb-8">
              {MERCHANT_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{f.icon}</span>
                  <span className="text-amber-100 text-sm leading-relaxed">{f.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/register" className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-amber-50 transition-colors text-sm">
              {t('landing.merchantCta')}
            </Link>
          </div>

        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="bg-amber-400 text-gray-900 py-10">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.value}>
              <div className="text-2xl md:text-3xl font-bold mb-1">{s.value}</div>
              <div className="text-amber-800 text-sm leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── UBUNTU ── */}
      <section className="bg-green-950 py-14 md:py-20 text-center px-4">
        <p className="text-2xl md:text-4xl font-serif italic text-amber-300 tracking-wide">
          &ldquo;Umuntu ngumuntu ngabantu.&rdquo;
        </p>
        <p className="mt-4 text-green-300 text-sm md:text-base tracking-widest uppercase">
          {t('landing.ubuntuSubtitle')}
        </p>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section id="comment" className="max-w-6xl mx-auto px-4 py-14 md:py-24 scroll-mt-20">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-green-600 tracking-widest uppercase">{t('landing.sectionSystem')}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">
            {t('landing.howTitle')}
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            {t('landing.howSubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.num} className="relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all">
              <div className={`w-12 h-12 ${step.color} rounded-2xl flex items-center justify-center text-white font-bold text-lg mb-5 shadow-sm`}>
                {step.num}
              </div>
              <div className="text-4xl mb-4">{step.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Codes de commission */}
        <div className="mt-14 bg-green-50 border border-green-100 rounded-3xl p-8">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-green-600 tracking-widest uppercase">{t('landing.transparencyLabel')}</span>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-2 mb-2">
              {t('landing.feesTitle')}
            </h3>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              {t('landing.feesSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {FEE_CODES.map(({ code, label, desc }) => (
              <div key={code} className="bg-white rounded-2xl p-4 text-center border border-green-100 shadow-sm">
                <p className="text-2xl font-bold text-green-700 mb-1">{code}</p>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            {t('landing.feesNote')}
          </p>
        </div>
      </section>

      {/* ── VALEURS ── */}
      <section id="valeurs" className="max-w-6xl mx-auto px-4 py-14 md:py-24 scroll-mt-20">
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-green-600 tracking-widest uppercase">{t('landing.promiseLabel')}</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">
            {t('landing.whyTitle')}
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            {t('landing.whySubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map((v) => (
            <div key={v.title} className={`${v.bg} rounded-2xl p-8 border ${v.border}`}>
              <div className={`w-12 h-12 ${v.iconBg} rounded-2xl flex items-center justify-center text-2xl mb-5`}>
                {v.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{v.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-6xl mx-auto px-4 pb-16 md:pb-24 text-center">
        <div className="relative overflow-hidden bg-green-700 rounded-3xl px-8 py-16 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl overflow-hidden shadow-xl border border-white/20">
              <Image src="/logo-transparent.png" alt="GreenFlame" width={64} height={64} className="object-contain w-full h-full" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-green-200 mb-8 max-w-md mx-auto">
              {t('landing.ctaSubtitle')}
            </p>
            <Link href="/register" className="inline-block bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-base hover:bg-green-50 transition-colors shadow-lg">
              {t('landing.ctaJoin')}
            </Link>
            <div className="mt-5">
              <button onClick={handleInstall} className="inline-flex items-center gap-2 text-green-200 text-sm hover:text-white transition-colors pointer-events-auto">
                <span>🔥</span>
                <span>Télécharger l&apos;app Android (.apk)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── BANDEAU INSTALL PWA ── */}
      {showInstall && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-green-700 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-white/20">
              <Image src="/logo-transparent.png" alt="GreenFlame" width={36} height={36} className="object-contain w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Installer GreenFlame</p>
              <p className="text-xs text-green-200 truncate">Accès rapide depuis l&apos;écran d&apos;accueil</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="bg-white text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
            >
              Installer
            </button>
            <button
              onClick={() => setShowInstall(false)}
              className="text-green-300 hover:text-white text-xl leading-none p-1"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-10 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-gray-200">
              <Image src="/logo-transparent.png" alt="GreenFlame" width={28} height={28} className="object-contain w-full h-full" />
            </div>
            <span className="font-medium text-gray-600">GreenFlame</span>
            <span>— {t('landing.footerTagline')}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">{t('landing.footerTerms')}</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">{t('landing.footerPrivacy')}</Link>
            <Link href="/demo" className="hover:text-gray-600 transition-colors">{t('landing.navDemo')}</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
