import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface SaleItem {
  product_id: string
  qty: number
  unit_price: number
}

export async function POST(request: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Resolve business
  const { data: memberRow } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!memberRow) return NextResponse.json({ error: 'Aucun espace Business' }, { status: 403 })
  const businessId = memberRow.business_id

  const body = await request.json() as {
    items: SaleItem[]
    total: number
    payment_method: 'cash' | 'momo' | 'card'
    customer_id?: string
    gf_user_id?: string
  }

  const { items, total, payment_method, customer_id, gf_user_id } = body
  if (!items?.length) return NextResponse.json({ error: 'Panier vide' }, { status: 400 })

  const svc = createServiceClient()

  // Create POS transaction
  const { data: tx, error: txErr } = await svc
    .from('biz_pos_transactions')
    .insert({
      business_id:    businessId,
      cashier_id:     user.id,
      customer_id:    customer_id ?? null,
      gf_user_id:     gf_user_id ?? null,
      items:          items,
      total,
      payment_method,
      status:         'completed',
    })
    .select('id')
    .single()

  if (txErr || !tx) return NextResponse.json({ error: txErr?.message ?? 'Erreur enregistrement' }, { status: 500 })

  // Deduct stock for each item
  for (const item of items) {
    const { data: inv } = await svc
      .from('biz_inventory')
      .select('id, quantity')
      .eq('business_id', businessId)
      .eq('product_id', item.product_id)
      .maybeSingle()

    if (inv) {
      await svc.from('biz_inventory').update({ quantity: Math.max(0, (inv.quantity ?? 0) - item.qty) }).eq('id', inv.id)
      await svc.from('biz_inventory_moves').insert({
        business_id: businessId,
        product_id:  item.product_id,
        move_type:   'out',
        quantity:    item.qty,
        note:        `Vente caisse #${tx.id.slice(0, 8)}`,
      })
    }
  }

  return NextResponse.json({ ok: true, transaction_id: tx.id })
}
