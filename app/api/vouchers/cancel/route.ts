import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/vouchers/cancel — annuler un bon actif et recréditer le wallet
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { voucherId } = await req.json()
  if (!voucherId) return NextResponse.json({ error: 'ID du bon requis' }, { status: 400 })

  const svc = createServiceClient()

  // Récupérer le bon — doit appartenir à l'utilisateur
  const { data: voucher } = await svc
    .from('withdrawal_vouchers')
    .select('id, sender_id, amount_fcfa, status, code')
    .eq('id', voucherId)
    .eq('sender_id', user.id)
    .single()

  if (!voucher) return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 })

  if (voucher.status !== 'active') {
    return NextResponse.json({
      error: voucher.status === 'redeemed'
        ? 'Ce bon a déjà été encaissé'
        : voucher.status === 'cancelled'
        ? 'Ce bon est déjà annulé'
        : 'Ce bon a expiré',
    }, { status: 409 })
  }

  // Récupérer le wallet du sender
  const { data: wallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 500 })

  const newBalance = wallet.balance_fcfa + voucher.amount_fcfa

  // Recréditer le wallet
  const { error: creditError } = await svc
    .from('wallets')
    .update({ balance_fcfa: newBalance })
    .eq('id', wallet.id)

  if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 })

  // Ledger entry
  await svc.from('wallet_ledger').insert({
    wallet_id:        wallet.id,
    amount:           voucher.amount_fcfa,
    currency_type:    'fcfa',
    transaction_type: 'voucher_cancel',
    balance_after:    newBalance,
  })

  // Marquer le bon comme annulé
  await svc
    .from('withdrawal_vouchers')
    .update({ status: 'cancelled' })
    .eq('id', voucher.id)

  return NextResponse.json({ success: true, amount_fcfa: voucher.amount_fcfa })
}
