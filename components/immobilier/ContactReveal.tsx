'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { getTranslations } from '@/lib/i18n'
import { PassPurchaseForm } from './PassPurchaseForm'

const CATEGORY_ICON = '#0F6E56'

type State = 'idle' | 'loading' | 'revealed' | 'passRequired' | 'error'

export function ContactReveal({ propertyId, locale, isLoggedIn }: { propertyId: string; locale: Locale; isLoggedIn: boolean }) {
  const t = getTranslations(locale)
  const [state, setState] = useState<State>('idle')
  const [contact, setContact] = useState<{ name: string; phone: string | null } | null>(null)

  async function reveal() {
    setState('loading')
    const res = await fetch(`/api/immobilier/${propertyId}/contact`)
    if (res.status === 402) { setState('passRequired'); return }
    if (!res.ok) { setState('error'); return }
    const json = await res.json()
    setContact({ name: json.name, phone: json.phone })
    setState('revealed')
  }

  return (
    <div className="mt-6 border border-gray-100 rounded-2xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('immobilier.contactSectionTitle')}</h2>

      {!isLoggedIn && (
        <div>
          <p className="text-sm text-gray-600 mb-2">{t('immobilier.contactLoginRequired')}</p>
          <Link href="/login" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: CATEGORY_ICON }}>
            {t('immobilier.contactLoginCta')}
          </Link>
        </div>
      )}

      {isLoggedIn && state === 'idle' && (
        <button onClick={reveal} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: CATEGORY_ICON }}>
          {t('immobilier.contactRevealCta')}
        </button>
      )}

      {state === 'loading' && <p className="text-sm text-gray-500">{t('immobilier.contactLoading')}</p>}

      {state === 'error' && <p className="text-sm text-red-500">{t('immobilier.contactErrorGeneric')}</p>}

      {state === 'revealed' && contact && (
        <div>
          <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
          {contact.phone && <p className="text-sm text-gray-600 mt-1">{t('immobilier.contactPhoneRevealed').replace('{phone}', contact.phone)}</p>}
        </div>
      )}

      {state === 'passRequired' && (
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('immobilier.contactPassRequiredTitle')}</p>
          <p className="text-sm text-gray-500 mt-1 mb-3">{t('immobilier.contactPassRequiredHint')}</p>
          <PassPurchaseForm locale={locale} onSuccess={reveal} />
        </div>
      )}
    </div>
  )
}
