import { headers } from 'next/headers'
import { getTranslations, defaultLocale, type Locale } from '@/lib/i18n'

/**
 * Server-side translation helper — use inside async server components.
 * Reads the x-locale header injected by the middleware.
 *
 * @example
 * const { t, locale } = await getServerT()
 * return <h1>{t('wallet.myWallet')}</h1>
 */
export async function getServerT() {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') ?? defaultLocale) as Locale
  const t = getTranslations(locale)
  return { t, locale }
}
