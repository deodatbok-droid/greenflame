'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS, MOBILE_PRIMARY_HREFS, type BizNavItem } from './biz-nav-items'

const ALL_ITEMS: BizNavItem[] = NAV_GROUPS.flatMap(g => g.items)
const PRIMARY_ITEMS = MOBILE_PRIMARY_HREFS
  .map(href => ALL_ITEMS.find(item => item.href === href))
  .filter((item): item is BizNavItem => Boolean(item))
const MORE_ITEMS = ALL_ITEMS.filter(item => !MOBILE_PRIMARY_HREFS.includes(item.href))

function DotsIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="4" cy="10" r="1.8" />
      <circle cx="10" cy="10" r="1.8" />
      <circle cx="16" cy="10" r="1.8" />
    </svg>
  )
}

function isActive(pathname: string, href: string) {
  if (href === '/business/dashboard') return pathname === '/business/dashboard' || pathname === '/business'
  if (href === '/business/stock') return pathname === '/business/stock' || pathname === '/business/stock/ajouter'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function BizBottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const isMoreActive = MORE_ITEMS.some(item => isActive(pathname, item.href))

  return (
    <>
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowMore(false)}
            aria-hidden="true"
          />
          <div className="biz-bottom-more fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-xl">
            <div className="max-w-lg mx-auto grid grid-cols-3 gap-1 px-3 py-3">
              {MORE_ITEMS.map(item => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl min-w-0 transition-colors ${
                      active ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <span className="text-[11px] font-medium truncate w-full text-center">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      <nav className="biz-bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-bottom">
        <div className="flex max-w-lg mx-auto">
          {PRIMARY_ITEMS.map(item => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 min-w-0 transition-all active:scale-95 ${
                  active ? 'text-brand-600' : 'text-gray-500'
                }`}
              >
                <span className={`absolute top-0 h-0.5 rounded-full transition-all duration-300 ${
                  active ? 'w-8 bg-brand-500' : 'w-0'
                }`} />
                <div className={`flex items-center justify-center mt-0.5 h-7 rounded-2xl transition-all duration-300 ${
                  active ? 'bg-brand-100 px-3' : 'px-1'
                }`}>
                  <span className={`leading-none transition-all duration-300 ${
                    active ? 'text-[1.75rem]' : 'text-xl'
                  }`}>{item.icon}</span>
                </div>
                <span className="text-[10px] font-medium leading-tight mt-0.5 w-full text-center truncate px-1">
                  {item.label}
                </span>
              </Link>
            )
          })}

          <button
            onClick={() => setShowMore(o => !o)}
            aria-label="Plus d'options"
            className={`relative flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1.5 min-w-0 transition-all active:scale-95 ${
              isMoreActive || showMore ? 'text-brand-600' : 'text-gray-500'
            }`}
          >
            <span className={`absolute top-0 h-0.5 rounded-full transition-all duration-300 ${
              isMoreActive || showMore ? 'w-8 bg-brand-500' : 'w-0'
            }`} />
            <div className={`flex items-center justify-center mt-0.5 h-8 rounded-2xl transition-all duration-300 ${
              isMoreActive || showMore ? 'bg-brand-100 px-3' : 'px-1'
            }`}>
              <DotsIcon />
            </div>
            <span className="text-[10px] font-medium leading-tight mt-0.5">Plus</span>
          </button>
        </div>
      </nav>
    </>
  )
}
