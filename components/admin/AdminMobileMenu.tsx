'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLink { href: string; label: string }

export default function AdminMobileMenu({ links, userName }: { links: NavLink[]; userName: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setOpen(o => !o)}
        className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-gray-700 transition-colors"
        aria-label="Menu"
      >
        <span className={`block w-5 h-0.5 bg-gray-300 transition-all ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
        <span className={`block w-5 h-0.5 bg-gray-300 transition-all ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-gray-300 transition-all ${open ? '-rotate-45 -translate-y-1.5' : ''}`} />
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          {/* Slide-in panel */}
          <div className="fixed top-0 right-0 h-full w-72 bg-gray-800 border-l border-gray-700 z-50 md:hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <span className="font-bold text-white">🔥 Admin</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {userName && (
              <div className="px-5 py-3 border-b border-gray-700">
                <p className="text-xs text-gray-400">Connecté en tant que</p>
                <p className="text-sm text-white font-medium mt-0.5">{userName}</p>
              </div>
            )}

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {links.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname.startsWith(l.href)
                      ? 'bg-brand-600/20 text-brand-400'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="px-5 py-4 border-t border-gray-700">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-brand-400 text-sm font-medium"
              >
                ← Retour à l&apos;app
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
