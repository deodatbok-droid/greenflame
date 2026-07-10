import fr from '@/messages/fr.json'
import en from '@/messages/en.json'

export type Locale = 'fr' | 'en'
export const locales: Locale[] = ['fr', 'en']
export const defaultLocale: Locale = 'fr'

const messages = { fr, en } as const

// Flatten nested object keys into dot-notation strings
type Flatten<T, Prefix extends string = ''> = T extends object
  ? { [K in keyof T & string]: Flatten<T[K], Prefix extends '' ? K : `${Prefix}.${K}`> }[keyof T & string]
  : Prefix

export type TranslationKey = Flatten<typeof fr>

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current != null && typeof current === 'object' && part in (current as object)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path // fallback: return the key itself
    }
  }
  return typeof current === 'string' ? current : path
}

export function getTranslations(locale: Locale) {
  const msgs = messages[locale] as unknown as Record<string, unknown>
  return function t(key: TranslationKey): string {
    return getNestedValue(msgs, key)
  }
}
