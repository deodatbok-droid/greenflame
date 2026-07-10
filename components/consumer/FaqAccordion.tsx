'use client'

import { useState } from 'react'
import { FAQ_GROUPS, MERCHANT_FAQ_GROUPS, type FaqGroup } from '@/lib/faq/content'

export default function FaqAccordion({ isMerchant = false }: { isMerchant?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const groups: FaqGroup[] = isMerchant ? [...FAQ_GROUPS, ...MERCHANT_FAQ_GROUPS] : FAQ_GROUPS

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <div key={group.category} className="card">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-wide mb-2">
            {group.category}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item, ii) => {
              const key = `${gi}-${ii}`
              return (
                <div key={key} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => setOpen(open === key ? null : key)}
                    className="w-full flex items-start justify-between py-3 text-left gap-3"
                  >
                    <span className="text-sm font-medium text-gray-800 leading-snug">{item.q}</span>
                    <span className={`text-gray-400 text-sm flex-shrink-0 mt-0.5 transition-transform ${open === key ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>
                  {open === key && (
                    <p className="text-sm text-gray-500 pb-3 leading-relaxed">{item.a}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
