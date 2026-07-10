import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MesAchatsClient from './MesAchatsClient'

export const revalidate = 0

export default async function MesAchatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  // Transactions avec articles, marchand et infos livraison
  const { data: transactions } = await svc
    .from('transactions')
    .select(`
      id, created_at, amount_fcfa, status,
      delivery_type, escrow_status, escrow_expires_at,
      merchants!inner(business_name, public_slug),
      transaction_items(id, product_name, quantity, unit_price_fcfa, emoji, product_id),
      delivery_orders(
        id, status, delivery_address, assigned_at, picked_up_at, delivered_at,
        delivery_providers(display_name, phone)
      )
    `)
    .eq('buyer_id', user.id)
    .not('status', 'in', '("failed","refunded")')
    .order('created_at', { ascending: false })
    .limit(50)

  // Pack Mystère achetés
  const { data: packs } = await svc
    .from('mystery_pack_purchases')
    .select(`
      id, pack_tier, price_paid_fcfa, status, opened_at, created_at,
      mystery_pack_items(
        id, delivered, delivered_at,
        pack_item_catalog:catalog_item_id(name_fr, rarity, item_type, description_fr)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <MesAchatsClient
      transactions={(transactions ?? []) as any[]}
      packs={(packs ?? []) as any[]}
      userId={user.id}
    />
  )
}
