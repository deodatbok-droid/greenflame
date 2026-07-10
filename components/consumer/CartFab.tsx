'use client'

import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { usePathname } from 'next/navigation'

export default function CartFab() {
  const { totalItems } = useCart()
  const pathname = usePathname()

  if (totalItems === 0 || pathname === '/panier') return null

  return (
    <Link
      href="/panier"
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all"
    >
      <span className="text-lg leading-none">🛒</span>
      <span className="font-bold text-sm">{totalItems}</span>
    </Link>
  )
}
