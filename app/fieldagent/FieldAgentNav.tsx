'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/fieldagent/dashboard',   icon: '📋', label: 'Dossiers' },
  { href: '/fieldagent/pending-kyc', icon: '🪪', label: 'KYC' },
  { href: '/fieldagent/float',       icon: '💵', label: 'Float' },
  { href: '/dashboard',              icon: '🏠', label: 'Accueil' },
] as const

export default function FieldAgentNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40 safe-bottom">
      <div className="flex max-w-lg mx-auto">
        {NAV.map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors active:scale-95 ${
                isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className={`relative leading-none transition-transform ${isActive ? 'text-2xl' : 'text-xl'}`}>
                {item.icon}
                {isActive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-brand-400 rounded-full" />
                )}
              </span>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
