import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!caller?.role?.includes('admin')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: { targetUserId: string; amountFcfa?: number; amountGfp?: number; reason?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { targetUserId, amountFcfa = 0, amountGfp = 0 } = body

  if (!targetUserId) return NextResponse.json({ error: 'targetUserId requis' }, { status: 400 })
  if (amountFcfa < 0 || amountGfp < 0) return NextResponse.json({ error: 'Montants positifs uniquement' }, { status: 400 })
  if (amountFcfa === 0 && amountGfp === 0) return NextResponse.json({ error: 'Au moins un montant requis' }, { status: 400 })
  if (amountFcfa > 1_000_000 || amountGfp > 1_000_000) return NextResponse.json({ error: 'Max 1 000 000 par opération' }, { status: 400 })

  const service = createServiceClient()

  const { data: wallet, error: walletErr } = await service
    .from('wallets')
    .select('id, balance_fcfa, balance_gfp, total_earned_fcfa')
    .eq('user_id', targetUserId)
    .single()

  if (walletErr || !wallet) return NextResponse.json({ error: 'Wallet introuvable pour cet utilisateur' }, { status: 404 })

  const newFcfa = wallet.balance_fcfa + amountFcfa
  const newGfp  = wallet.balance_gfp  + amountGfp

  const { error: updateErr } = await service.from('wallets').update({
    balance_fcfa:      newFcfa,
    balance_gfp:       newGfp,
    total_earned_fcfa: wallet.total_earned_fcfa + amountFcfa,
    updated_at:        new Date().toISOString(),
  }).eq('id', wallet.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (amountFcfa > 0) {
    await service.from('wallet_ledger').insert({
      wallet_id:        wallet.id,
      amount:           amountFcfa,
      currency_type:    'fcfa',
      transaction_type: 'admin_credit',
      balance_after:    newFcfa,
    })
  }

  return NextResponse.json({ ok: true, balance_fcfa: newFcfa, balance_gfp: newGfp })
}
