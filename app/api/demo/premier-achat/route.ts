import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_EMAIL, DEMO_PHONE } from '@/lib/demo/data'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const svc = createServiceClient()
  const uid = user.id

  // Activer le compte (upsert pour garantir que la ligne existe)
  await svc.from('users').upsert({
    id:            uid,
    phone:         DEMO_PHONE,
    full_name:     'GreenFlame Demo',
    email:         DEMO_EMAIL,
    role:          'consumer',
    is_active:     true,
    referral_code: 'GF-DEMO2024',
  }, { onConflict: 'id' })

  // Wallet : créer s'il n'existe pas, ajouter un cashback sinon
  const { data: wallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa, balance_gfp, total_earned_fcfa, total_spent_fcfa')
    .eq('user_id', uid)
    .maybeSingle()

  const cashback = 600
  const spent    = 5000
  const now      = new Date().toISOString()

  if (!wallet) {
    await svc.from('wallets').insert({
      user_id:          uid,
      balance_fcfa:     cashback,
      balance_gfp:      0,
      total_spent_fcfa: spent,
      total_earned_fcfa: cashback,
      updated_at:        now,
    })
  } else {
    const newBalance = wallet.balance_fcfa + cashback
    await svc.from('wallets').update({
      balance_fcfa:      newBalance,
      total_spent_fcfa:  (wallet.total_spent_fcfa ?? 0) + spent,
      total_earned_fcfa: (wallet.total_earned_fcfa ?? 0) + cashback,
      updated_at:        now,
    }).eq('user_id', uid)

    // Entrée ledger pour le cashback
    await svc.from('wallet_ledger').insert({
      wallet_id:        wallet.id,
      amount:           cashback,
      currency_type:    'fcfa',
      transaction_type: 'cashback',
      balance_after:    newBalance,
      notes:            'Cashback — 1er achat démo',
      created_at:       now,
    })
  }

  // Créer une transaction démo (idempotent)
  const txKey = `demo-premier-achat-${uid}`
  const { data: existingTx } = await svc
    .from('transactions')
    .select('id')
    .eq('idempotency_key', txKey)
    .maybeSingle()

  if (!existingTx) {
    const { data: merchant } = await svc
      .from('merchants')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle()

    if (merchant?.id) {
      await svc.from('transactions').insert({
        buyer_id:        uid,
        merchant_id:     merchant.id,
        amount_fcfa:     spent,
        commission_total: 1000,
        commission_rate:  0.20,
        status:           'completed',
        payment_method:   'mtn_momo',
        idempotency_key:  txKey,
        completed_at:     now,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
