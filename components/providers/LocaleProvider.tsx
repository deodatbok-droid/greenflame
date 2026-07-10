'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import type { Locale, TranslationKey } from '@/lib/i18n'
import { getTranslations, locales } from '@/lib/i18n'

interface LocaleContextType {
  locale: Locale
  t: (key: TranslationKey) => string
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'fr',
  t: (key) => key as string,
})

export function LocaleProvider({
  locale: serverLocale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const pathname = usePathname()

  // Derive locale from the browser URL on every navigation — the root layout
  // never re-renders on client-side navigation, so serverLocale would stay stale.
  const locale = useMemo((): Locale => {
    for (const loc of locales) {
      if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) return loc
    }
    return serverLocale
  }, [pathname, serverLocale])

  const t = useMemo(() => getTranslations(locale), [locale])

  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
