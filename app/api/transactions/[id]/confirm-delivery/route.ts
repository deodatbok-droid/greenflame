import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { distributeCommissions } from '@/lib/commission-engine/distribute'

/**
 * POST /api/transactions/[id]/confirm-delivery
 *
 * L'acheteur confirme qu'il a reçu sa commande.
 * Déclenche la libération de l'escrow et la redistribution des commissions.
 *
 * Autorisé : l'acheteur lui-même OU un admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: transactionId } = await params
  const svc = createServiceClient()

  const { data: tx } = await svc
    .from('transactions')
    .select('id, buyer_id, status, escrow_status, delivery_type')
    .eq('id', transactionId)
    .single()

  if (!tx) return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })

  // Vérifications
  if (tx.delivery_type !== 'delivery') {
    return NextResponse.json({ error: 'Cette transaction n\'est pas une livraison' }, { status: 400 })
  }
  if (tx.status !== 'escrow' || tx.escrow_status !== 'held') {
    return NextResponse.json({ error: `Statut invalide : ${tx.status} / ${tx.escrow_status}` }, { status: 409 })
  }

  // Autorisation : uniquement l'acheteur ou un admin
  if (user.id !== tx.buyer_id) {
    const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!caller?.role?.includes('admin') && !caller?.role?.includes('platform_upline')) {
      return NextResponse.json({ error: 'Accès refusé — seul l\'acheteur peut confirmer la réception' }, { status: 403 })
    }
  }

  const now = new Date().toISOString()

  // 1. Marquer l'escrow comme libéré
  await svc.from('transactions').update({
    escrow_status:        'released',
    delivery_confirmed_at: now,
  }).eq('id', transactionId)

  // 2. Marquer la delivery_order comme livrée
  await svc.from('delivery_orders').update({
    status:       'delivered',
    delivered_at: now,
    updated_at:   now,
  }).eq('transaction_id', transactionId)

  // 3. Distribuer les commissions
  const result = await distributeCommissions(transactionId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Erreur distribution' }, { status: 500 })
  }

  // 4. Logguer la notification de libération (éviter doublon cron)
  await svc.from('escrow_notifications').upsert({
    transaction_id: transactionId,
    notif_type:     'released',
    sent_at:        now,
  }, { onConflict: 'transaction_id,notif_type' }).select()

  return NextResponse.json({
    ok:       true,
    cashback: result.cashback,
    message:  'Réception confirmée. Les fonds ont été distribués.',
  })
}
