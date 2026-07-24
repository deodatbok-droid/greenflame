'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/providers/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n'
import MessagesUnreadBadge from './MessagesUnreadBadge'

// 5 onglets primaires — Marketplace accessible depuis Dashboard et Profile
const navItems: { href: string; labelKey: TranslationKey; icon: string; exact?: boolean }[] = [
  { href: '/dashboard',  labelKey: 'nav.home',      icon: '🏠', exact: true },
  { href: '/decouvrir',  labelKey: 'nav.discover',  icon: '📍' },
  { href: '/pay',        labelKey: 'nav.pay',       icon: '📱' },
  { href: '/messages',   labelKey: 'nav.messages',  icon: '💬' },
  { href: '/profile',    labelKey: 'nav.profile',   icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-40">
      <div className="flex max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 min-w-0 transition-all active:scale-95 ${
                isActive ? 'text-brand-600' : 'text-gray-400'
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
              {item.href === '/messages' && <MessagesUnreadBadge />}
              <span className="text-[10px] font-medium leading-tight mt-0.5 w-full text-center truncate px-1">
                {t(item.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
