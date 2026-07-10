'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/components/providers/LocaleProvider'
import { locales, type Locale } from '@/lib/i18n'

export default function LangToggle({ className }: { className?: string }) {
  const { locale } = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function switchLocale(newLocale: Locale) {
    setOpen(false)
    if (newLocale === locale) return
    let cleanPath = pathname
    for (const loc of locales) {
      if (cleanPath.startsWith(`/${loc}/`)) {
        cleanPath = cleanPath.slice(`/${loc}`.length)
        break
      } else if (cleanPath === `/${loc}`) {
        cleanPath = '/'
        break
      }
    }
    const path = cleanPath === '/' ? '' : cleanPath
    router.push(`/${newLocale}${path}`)
  }

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  return (
    <div
      ref={ref}
      className={`relative ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Changer de langue"
        className="flex items-center gap-1 text-xs font-extrabold tracking-wide uppercase transition-colors"
      >
        {locale.toUpperCase()}
        <span className="text-[9px] opacity-50">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-md py-1 z-50 min-w-[48px]"
        >
          {locales.map((loc) => (
            <button
              key={loc}
              role="option"
              aria-selected={loc === locale}
              onClick={() => switchLocale(loc)}
              className={`w-full text-center px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
                loc === locale
                  ? 'text-brand-600 bg-brand-50'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
