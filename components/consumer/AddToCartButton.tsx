'use client'

import { useState } from 'react'
import { useCart } from '@/context/CartContext'

interface Props {
  productId: string
  merchantId: string
  merchantName: string
  name: string
  price_fcfa: number
  emoji?: string
}

export default function AddToCartButton({ productId, merchantId, merchantName, name, price_fcfa, emoji }: Props) {
  const { addItem, items } = useCart()
  const [added, setAdded] = useState(false)

  const inCart = items.some(i => i.productId === productId)

  function handleAdd() {
    addItem({ productId, merchantId, merchantName, name, price_fcfa, emoji })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <button
      onClick={handleAdd}
      className="w-full py-3 rounded-2xl font-bold text-base border-2 border-brand-600 text-brand-600 hover:bg-brand-50 active:scale-95 transition-all"
    >
      {added ? '✓ Ajouté !' : inCart ? '🛒 Dans le panier' : '🛒 Ajouter au panier'}
    </button>
  )
}
