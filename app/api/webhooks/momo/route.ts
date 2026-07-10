import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { distributeCommissions } from '@/lib/commission-engine/distribute'

// Ce webhook est appele par MTN MoMo et Moov Money pour confirmer un paiement
// L'URL doit etre configuree dans les portails developpeur MoMo
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  const rawBody = await req.text()

  // MOMO_WEBHOOK_SECRET est obligatoire en production.
  // En dev (NODE_ENV !== 'production'), la vérification est optionnelle.
  const webhookSecret = process.env.MOMO_WEBHOOK_SECRET
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] MOMO_WEBHOOK_SECRET absent — tous les callbacks refusés')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
    // Dev uniquement : continuer sans vérification HMAC
  } else {
    const signature = req.headers.get('X-Callback-Signature') ?? req.headers.get('X-Signature') ?? ''
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    try {
      const sigBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
      const expBuf = Buffer.from(expected, 'hex')
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const operator = req.headers.get('X-MoMo-Operator') ?? 'mtn_momo'

  let referenceId: string
  let status: string
  let externalId: string

  if (operator === 'mtn_momo') {
    referenceId = body.referenceId as string
    status      = body.status as string
    externalId  = body.externalId as string
  } else {
    referenceId = body.transactionId as string
    status      = body.status as string
    externalId  = body.orderId as string
  }

  if (!referenceId || !status || !externalId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: transaction } = await supabase
    .from('transactions')
    .select('id, status, delivery_type, buyer_id, merchant_id')
    .eq('idempotency_key', externalId)
    .single()

  if (!transaction) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Déjà traité — réponse idempotente
  if (transaction.status !== 'processing') {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  if (status === 'SUCCESSFUL') {
    // Enregistrer la référence MoMo sur la transaction
    await supabase.from('transactions').update({
      payment_reference: referenceId,
    }).eq('id', transaction.id)

    if (transaction.delivery_type === 'delivery') {
      // Livraison MoMo → placer en ESCROW (48h)
      // Les fonds sont reçus mais non distribués tant que l'acheteur ne confirme pas
      const escrowExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      await supabase.from('transactions').update({
        status:            'escrow',
        escrow_status:     'held',
        escrow_expires_at: escrowExpiresAt,
      }).eq('id', transaction.id)

      // Créer la delivery_order associée
      const { data: txFull } = await supabase
        .from('transactions')
        .select('delivery_address, buyer_id, merchant_id')
        .eq('id', transaction.id)
        .single()
      if (txFull) {
        await supabase.from('delivery_orders').insert({
          transaction_id:   transaction.id,
          buyer_id:         txFull.buyer_id,
          merchant_id:      txFull.merchant_id,
          delivery_address: txFull.delivery_address ?? 'À préciser',
          status:           'pending_assignment',
        })
      }
    } else {
      // Retrait ou pickup → distribution immédiate
      const result = await distributeCommissions(transaction.id)
      if (!result.ok) {
        console.error('[momo webhook] distributeCommissions failed:', result.error)
        // Ne pas retourner d'erreur à MoMo — éviter les retry infinis
      }
    }
  } else {
    // Paiement échoué
    await supabase.from('transactions').update({
      status:            'failed',
      payment_reference: referenceId,
    }).eq('id', transaction.id)
  }

  return NextResponse.json({ ok: true })
}
