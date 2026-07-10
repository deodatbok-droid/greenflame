import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Consumer calls this to create a pending cash transaction that the merchant will confirm
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { merchantId: string; amountFcfa: number; idempotencyKey: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { merchantId, amountFcfa, idempotencyKey } = body
  if (!merchantId || !amountFcfa || amountFcfa < 100 || !idempotencyKey) {
    return NextResponse.json({ error: 'Paramètres invalides (montant min 100 FCFA)' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: merchant } = await service
    .from('merchants')
    .select('id, commission_rate, is_active')
    .eq('id', merchantId)
    .single()

  if (!merchant?.is_active) return NextResponse.json({ error: 'Marchand introuvable ou inactif' }, { status: 404 })

  const commissionTotal = Math.floor(amountFcfa * merchant.commission_rate)

  const { data: tx, error } = await service
    .from('transactions')
    .insert({
      merchant_id:      merchantId,
      buyer_id:         user.id,
      amount_fcfa:      amountFcfa,
      commission_total: commissionTotal,
      commission_rate:  merchant.commission_rate,
      status:           'pending',
      payment_method:   'cash_confirmed',
      idempotency_key:  idempotencyKey,
      metadata:         { initiated_by: 'consumer', awaiting_merchant: true },
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Transaction en double' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transactionId: tx.id, status: 'pending' })
}
