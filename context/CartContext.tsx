'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface CartItem {
  productId: string
  merchantId: string
  merchantName: string
  name: string
  price_fcfa: number
  quantity: number
  emoji?: string
}

export interface MerchantGroup {
  merchantId: string
  merchantName: string
  items: CartItem[]
  subtotal: number
}

interface CartContextValue {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clearMerchant: (merchantId: string) => void
  clearAll: () => void
  totalItems: number
  groupedByMerchant: () => MerchantGroup[]
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'gf_cart_v1'

function persist(items: CartItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored))
    } catch {}
    setHydrated(true)
  }, [])

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId)
      const next = existing
        ? prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...item, quantity: 1 }]
      persist(next)
      return next
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId)
      persist(next)
      return next
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => {
        const next = prev.filter(i => i.productId !== productId)
        persist(next)
        return next
      })
      return
    }
    setItems(prev => {
      const next = prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i)
      persist(next)
      return next
    })
  }, [])

  const clearMerchant = useCallback((merchantId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.merchantId !== merchantId)
      persist(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const totalItems = hydrated ? items.reduce((s, i) => s + i.quantity, 0) : 0

  const groupedByMerchant = useCallback((): MerchantGroup[] => {
    const map = new Map<string, MerchantGroup>()
    for (const item of items) {
      if (!map.has(item.merchantId)) {
        map.set(item.merchantId, { merchantId: item.merchantId, merchantName: item.merchantName, items: [], subtotal: 0 })
      }
      const g = map.get(item.merchantId)!
      g.items.push(item)
      g.subtotal += item.price_fcfa * item.quantity
    }
    return Array.from(map.values())
  }, [items])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearMerchant, clearAll, totalItems, groupedByMerchant }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
