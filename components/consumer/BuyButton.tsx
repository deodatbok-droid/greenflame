'use client'

import { useCart } from '@/context/CartContext'
import { useRouter } from 'next/navigation'

interface Props {
  productId: string
  merchantId: string
  merchantName: string
  name: string
  price_fcfa: number
  emoji?: string
  outOfStock: boolean
}

export default function BuyButton({ productId, merchantId, merchantName, name, price_fcfa, emoji, outOfStock }: Props) {
  const { addItem } = useCart()
  const router = useRouter()

  function handleBuy() {
    if (outOfStock) return
    addItem({ productId, merchantId, merchantName, name, price_fcfa, emoji })
    router.push('/panier')
  }

  return (
    <button
      onClick={handleBuy}
      disabled={outOfStock}
      className="w-full bg-brand-600 hover:bg-brand-700 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-xl transition-all"
    >
      {outOfStock ? 'Indisponible' : 'Acheter 🔥'}
    </button>
  )
}
