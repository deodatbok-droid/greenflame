import Link from 'next/link'
import Logo from '@/components/Logo'
import { getServerT } from '@/lib/i18n/server'

export default async function NotFound() {
  const { t } = await getServerT()
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
        <Logo size={48} variant="onLight" />
      </div>
      <h1 className="text-white text-8xl font-black mb-2">404</h1>
      <p className="text-brand-100 text-xl font-semibold mb-2">{t('notFound.title')}</p>
      <p className="text-brand-200 text-sm mb-8 max-w-xs">
        {t('notFound.desc')}
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/marketplace"
          className="bg-white text-brand-700 font-bold px-6 py-3 rounded-2xl hover:bg-brand-50 transition-colors"
        >
          {t('notFound.explore')}
        </Link>
        <Link
          href="/"
          className="bg-white/20 text-white font-semibold px-6 py-3 rounded-2xl hover:bg-white/30 transition-colors"
        >
          {t('notFound.home')}
        </Link>
      </div>
      <p className="text-brand-300 text-xs mt-10">
        GreenFlame · {t('notFound.tagline')}
      </p>
    </div>
  )
}
