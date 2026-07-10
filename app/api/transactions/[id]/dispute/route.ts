import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp, ADMIN_PHONE } from '@/lib/whatsapp/wasender'

/**
 * POST /api/transactions/[id]/dispute
 *
 * L'acheteur ouvre un litige sur une transaction en escrow.
 * Les fonds restent bloqués ; l'admin est alerté immédiatement.
 *
 * Body: { reason: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id: transactionId } = await params
  const body = await req.json().catch(() => ({}))
  const reason: string = body.reason ?? ''

  const svc = createServiceClient()

  const { data: tx } = await svc
    .from('transactions')
    .select('id, buyer_id, merchant_id, amount_fcfa, status, escrow_status, delivery_type')
    .eq('id', transactionId)
    .single()

  if (!tx) return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })
  if (tx.buyer_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (tx.escrow_status !== 'held') {
    return NextResponse.json({ error: 'Aucun escrow actif sur cette transaction' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // Marquer la transaction en litige
  await svc.from('transactions').update({
    status:        'disputed',
    escrow_status: 'disputed',
  }).eq('id', transactionId)

  // Mettre à jour la delivery_order
  await svc.from('delivery_orders').update({
    status:     'failed_delivery',
    updated_at: now,
  }).eq('transaction_id', transactionId)

  // Logger la notification
  await svc.from('escrow_notifications').upsert({
    transaction_id: transactionId,
    notif_type:     'disputed',
    sent_at:        now,
  }, { onConflict: 'transaction_id,notif_type' }).select()

  // Alerter l'admin par WhatsApp (non-bloquant)
  ;(async () => {
    try {
      const [buyerRes, merchantRes] = await Promise.all([
        svc.from('users').select('full_name, phone').eq('id', tx.buyer_id).single(),
        svc.from('merchants').select('business_name').eq('id', tx.merchant_id).single(),
      ])
      const ref = transactionId.slice(0, 8).toUpperCase()
      sendWhatsApp(ADMIN_PHONE, `⚠️ LITIGE LIVRAISON\n\nTransaction : #${ref}\nAcheteur : ${buyerRes.data?.full_name ?? 'Inconnu'} (${buyerRes.data?.phone ?? ''})\nMarchand : ${merchantRes.data?.business_name ?? 'Inconnu'}\nMontant : ${tx.amount_fcfa.toLocaleString('fr-FR')} FCFA\n\nMotif : ${reason || 'Non précisé'}\n\nIntervenez sur /admin/transactions pour résoudre.`)
    } catch { /* non-bloquant */ }
  })()

  return NextResponse.json({
    ok:      true,
    message: 'Litige ouvert. Notre équipe va examiner votre demande dans les plus brefs délais.',
  })
}
