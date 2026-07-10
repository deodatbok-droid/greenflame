'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/providers/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n'
import MessagesUnreadBadge from './MessagesUnreadBadge'

// 5 onglets primaires — Wallet et Network accessibles depuis /profile et /dashboard
const navItems: { href: string; labelKey: TranslationKey; icon: string; exact?: boolean }[] = [
  { href: '/dashboard',   labelKey: 'nav.home',      icon: '🏠', exact: true },
  { href: '/marketplace', labelKey: 'nav.market',    icon: '🛍️' },
  { href: '/pay',         labelKey: 'nav.pay',       icon: '📱' },
  { href: '/messages',    labelKey: 'nav.messages',  icon: '💬' },
  { href: '/profile',     labelKey: 'nav.profile',   icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-40">
      <div className="flex max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 min-w-0 transition-colors ${
                isActive ? 'text-brand-600' : 'text-gray-400'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
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
