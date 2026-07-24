'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/providers/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n'

const PRIMARY_ITEMS: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/merchant/dashboard', labelKey: 'nav.dashboard', icon: '🏠' },
  { href: '/merchant/receive',   labelKey: 'nav.checkout',  icon: '💳' },
  { href: '/merchant/products',  labelKey: 'nav.products',  icon: '📦' },
  { href: '/merchant/tools',     labelKey: 'nav.tools',     icon: '🛠️' },
]

const MORE_ITEMS: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/merchant/vouchers', labelKey: 'nav.vouchers', icon: '🎟️' },
  { href: '/merchant/cashin',   labelKey: 'nav.cashin',   icon: '💵' },
  { href: '/merchant/promo',    labelKey: 'nav.promo',    icon: '📣' },
]

function DotsIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="4" cy="10" r="1.8" />
      <circle cx="10" cy="10" r="1.8" />
      <circle cx="16" cy="10" r="1.8" />
    </svg>
  )
}

export default function MerchantBottomNav() {
  const pathname = usePathname()
  const { t } = useLocale()
  const [showMore, setShowMore] = useState(false)

  const isMoreActive = MORE_ITEMS.some(item => pathname.startsWith(item.href))

  return (
    <>
      {/* Panneau "Plus" — slide depuis le bas */}
      {showMore && (
        <>
          {/* Backdrop invisible pour fermer */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowMore(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-xl">
            <div className="max-w-lg mx-auto flex justify-around px-4 py-3">
              {MORE_ITEMS.map(item => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1 px-6 py-2.5 rounded-2xl min-w-0 transition-colors ${
                      isActive ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <span className="text-[11px] font-medium truncate">{t(item.labelKey)}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-bottom">
        <div className="flex max-w-lg mx-auto">
          {PRIMARY_ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 min-w-0 transition-all active:scale-95 ${
                  isActive ? 'text-brand-600' : 'text-gray-500'
                }`}
              >
                <span className={`absolute top-0 h-0.5 rounded-full transition-all duration-300 ${
                  isActive ? 'w-8 bg-brand-500' : 'w-0'
                }`} />
                <div className={`flex items-center justify-center mt-0.5 h-7 rounded-2xl transition-all duration-300 ${
                  isActive ? 'bg-brand-100 px-3' : 'px-1'
                }`}>
                  <span className={`leading-none transition-all duration-300 ${
                    isActive ? 'text-[1.75rem]' : 'text-xl'
                  }`}>{item.icon}</span>
                </div>
                <span className="text-[10px] font-medium leading-tight mt-0.5 w-full text-center truncate px-1">
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}

          {/* Bouton Plus */}
          <button
            onClick={() => setShowMore(o => !o)}
            aria-label="Plus d'options"
            className={`relative flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 min-w-0 transition-all active:scale-95 ${
              isMoreActive || showMore ? 'text-brand-600' : 'text-gray-500'
            }`}
          >
            <span className={`absolute top-0 h-0.5 rounded-full transition-all duration-300 ${
              isMoreActive || showMore ? 'w-8 bg-brand-500' : 'w-0'
            }`} />
            <div className={`flex items-center justify-center mt-0.5 h-8 rounded-2xl transition-all duration-300 ${
              isMoreActive || showMore ? 'bg-brand-100 px-3' : 'px-1'
            }`}>
              <DotsIcon />
            </div>
            <span className="text-[10px] font-medium leading-tight mt-0.5">Plus</span>
          </button>
        </div>
      </nav>
    </>
  )
}
