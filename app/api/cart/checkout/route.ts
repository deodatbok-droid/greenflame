import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface CartLineItem {
  productId: string
  name: string
  price_fcfa: number
  quantity: number
  emoji?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { merchantId, items, totalAmount } = body as {
    merchantId: string
    items: CartLineItem[]
    totalAmount: number
  }

  if (!merchantId || !items?.length || !totalAmount) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Vérifier que le marchand est actif
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, is_active, user_id')
    .eq('id', merchantId)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Marchand introuvable ou inactif' }, { status: 404 })
  }
  if (merchant.user_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas acheter dans votre propre boutique' }, { status: 400 })
  }

  // Vérifier le solde wallet
  const { data: wallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!wallet || wallet.balance_fcfa < totalAmount) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
  }

  // Appeler process-transaction avec le total du groupe marchand
  const idempotencyKey = `cart-${user.id}-${merchantId}-${Date.now()}`

  const ptRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-transaction`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        merchantId,
        buyerId: user.id,
        amountFcfa: totalAmount,
        paymentMethod: 'wallet_gf',
        idempotencyKey,
      }),
    }
  )

  const ptData = await ptRes.json()
  if (!ptRes.ok || !ptData.transactionId) {
    return NextResponse.json({ error: ptData.error ?? 'Échec du paiement' }, { status: 500 })
  }

  // Insérer les lignes d'articles
  const transactionId = ptData.transactionId
  const lineItems = items.flatMap(item =>
    Array.from({ length: 1 }, () => ({
      transaction_id: transactionId,
      product_id: item.productId || null,
      product_name: item.name,
      quantity: item.quantity,
      unit_price_fcfa: item.price_fcfa,
      emoji: item.emoji ?? null,
    }))
  )

  await svc.from('transaction_items').insert(lineItems)

  return NextResponse.json({ transactionId, success: true })
}
