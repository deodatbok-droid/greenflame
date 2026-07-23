import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { phone, amount_fcfa, notes } = await req.json() as {
    phone?: string; amount_fcfa?: number; notes?: string
  }

  if (!phone?.trim())   return NextResponse.json({ error: 'Numéro du consommateur requis' }, { status: 400 })
  if (!amount_fcfa || amount_fcfa < 100) {
    return NextResponse.json({ error: 'Montant minimum : 100 FCFA' }, { status: 400 })
  }

  const phoneNorm = normalizePhone(phone.trim())

  // Vérifier le compte float de l'agent
  const { data: floatAccount } = await svc
    .from('agent_float_accounts')
    .select('id, balance_fcfa, is_active')
    .eq('agent_id', user.id)
    .maybeSingle()

  if (!floatAccount) {
    return NextResponse.json({ error: 'Aucun compte float actif. Contactez votre administrateur.' }, { status: 400 })
  }
  if (!floatAccount.is_active) {
    return NextResponse.json({ error: 'Compte float désactivé' }, { status: 400 })
  }
  if (floatAccount.balance_fcfa < amount_fcfa) {
    return NextResponse.json({
      error: `Solde float insuffisant : ${floatAccount.balance_fcfa.toLocaleString('fr-FR')} FCFA disponibles`,
    }, { status: 400 })
  }

  // Retrouver le consommateur et son wallet
  const { data: consumer } = await svc
    .from('users')
    .select('id, full_name')
    .eq('phone', phoneNorm)
    .maybeSingle()

  if (!consumer) return NextResponse.json({ error: 'Aucun compte GreenFlame pour ce numéro' }, { status: 404 })

  const { data: consumerWallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', consumer.id)
    .maybeSingle()

  if (!consumerWallet) return NextResponse.json({ error: 'Wallet consommateur introuvable' }, { status: 404 })

  const newFloatBalance   = floatAccount.balance_fcfa - amount_fcfa
  const newWalletBalance  = consumerWallet.balance_fcfa + amount_fcfa

  // 1. Débiter le float agent
  const { error: floatErr } = await svc
    .from('agent_float_accounts')
    .update({ balance_fcfa: newFloatBalance })
    .eq('id', floatAccount.id)

  if (floatErr) return NextResponse.json({ error: floatErr.message }, { status: 500 })

  // 2. Créditer le wallet consommateur
  const { error: walletErr } = await svc
    .from('wallets')
    .update({ balance_fcfa: newWalletBalance, updated_at: new Date().toISOString() })
    .eq('id', consumerWallet.id)

  if (walletErr) {
    // Compensation : remettre le float
    await svc.from('agent_float_accounts').update({ balance_fcfa: floatAccount.balance_fcfa }).eq('id', floatAccount.id)
    return NextResponse.json({ error: walletErr.message }, { status: 500 })
  }

  // 3. Entrée wallet_ledger (consommateur)
  await svc.from('wallet_ledger').insert({
    wallet_id:        consumerWallet.id,
    amount:           amount_fcfa,
    currency_type:    'fcfa',
    transaction_type: 'agent_cashin_credit',
    reference_id:     user.id,
    balance_after:    newWalletBalance,
  })

  // 4. Entrée agent_float_ledger
  await svc.from('agent_float_ledger').insert({
    agent_id:      user.id,
    entry_type:    'consumer_topup',
    amount_fcfa:   -amount_fcfa,
    balance_after: newFloatBalance,
    consumer_id:   consumer.id,
    notes:         notes?.trim() || null,
    created_by:    user.id,
  })

  // 5. Notification consommateur
  void insertNotification({
    userId:  consumer.id,
    type:    'wallet_credited',
    title:   'Crédit wallet GreenFlame',
    body:    `${amount_fcfa.toLocaleString('fr-FR')} FCFA ont été crédités sur votre wallet GreenFlame par notre agent terrain.`,
  })

  return NextResponse.json({
    ok: true,
    consumerName:    consumer.full_name,
    amountFcfa:      amount_fcfa,
    agentFloatAfter: newFloatBalance,
  })
}
