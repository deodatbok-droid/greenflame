import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { verifyPin } from '@/lib/utils/pin'
import { sendWhatsApp, waAgentDepositClient } from '@/lib/whatsapp/wasender'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { clientPhone: string; amountFcfa: number; clientPin: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { clientPhone, amountFcfa, clientPin } = body
  if (!clientPhone || !amountFcfa || !clientPin) {
    return NextResponse.json({ error: 'clientPhone, amountFcfa et clientPin sont requis' }, { status: 400 })
  }
  if (amountFcfa < 100) {
    return NextResponse.json({ error: 'Montant minimum : 100 FCFA' }, { status: 400 })
  }
  if (amountFcfa > 500_000) {
    return NextResponse.json({ error: 'Montant maximum par opération : 500 000 FCFA' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Vérifier que le marchand est actif et a le service agent
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, agent_service_active, is_active')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Compte marchand inactif' }, { status: 403 })
  }
  if (!merchant.agent_service_active) {
    return NextResponse.json({ error: 'Service Agent non activé sur ce compte' }, { status: 403 })
  }

  // Résoudre le client par numéro de téléphone
  const phoneNorm = normalizePhone(clientPhone.replace(/[\s\-().]/g, ''))
  const { data: clientUser } = await svc
    .from('users')
    .select('id, full_name, phone')
    .eq('phone', phoneNorm)
    .maybeSingle()

  if (!clientUser) {
    return NextResponse.json({ error: 'Aucun compte GreenFlame trouvé pour ce numéro' }, { status: 404 })
  }
  if (clientUser.id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas faire un cash-in sur votre propre compte' }, { status: 400 })
  }

  // Vérifier le PIN du client (consentement)
  const { data: clientPinRow } = await svc
    .from('users')
    .select('transaction_pin')
    .eq('id', clientUser.id)
    .single()

  if (!clientPinRow?.transaction_pin) {
    return NextResponse.json({ error: 'Ce client n\'a pas encore configuré son code PIN' }, { status: 400 })
  }
  const pinValid = clientPinRow.transaction_pin.includes(':')
    ? verifyPin(clientPin, clientPinRow.transaction_pin)
    : clientPinRow.transaction_pin === clientPin

  if (!pinValid) {
    return NextResponse.json({ error: 'Code PIN du client incorrect' }, { status: 401 })
  }

  // Charger le wallet du marchand (compte consommateur du marchand)
  const { data: merchantWallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!merchantWallet) {
    return NextResponse.json({ error: 'Wallet marchand introuvable' }, { status: 500 })
  }
  if (merchantWallet.balance_fcfa < amountFcfa) {
    return NextResponse.json({
      error: `Solde insuffisant. Votre wallet : ${merchantWallet.balance_fcfa.toLocaleString('fr-FR')} FCFA`,
    }, { status: 400 })
  }

  // Charger le wallet du client
  const { data: clientWallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', clientUser.id)
    .single()

  if (!clientWallet) {
    return NextResponse.json({ error: 'Wallet client introuvable' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const merchantNewBalance = merchantWallet.balance_fcfa - amountFcfa
  const clientNewBalance   = clientWallet.balance_fcfa   + amountFcfa

  // Débiter le wallet du marchand
  const { error: debitErr } = await svc
    .from('wallets')
    .update({ balance_fcfa: merchantNewBalance, updated_at: now })
    .eq('id', merchantWallet.id)

  if (debitErr) {
    return NextResponse.json({ error: 'Erreur débit wallet marchand' }, { status: 500 })
  }

  // Créditer le wallet du client
  const { error: creditErr } = await svc
    .from('wallets')
    .update({ balance_fcfa: clientNewBalance, total_earned_fcfa: clientWallet.balance_fcfa + amountFcfa, updated_at: now })
    .eq('id', clientWallet.id)

  if (creditErr) {
    // Rollback manuel du débit
    await svc.from('wallets').update({ balance_fcfa: merchantWallet.balance_fcfa, updated_at: now }).eq('id', merchantWallet.id)
    return NextResponse.json({ error: 'Erreur crédit wallet client — opération annulée' }, { status: 500 })
  }

  // Entrées dans wallet_ledger (append-only)
  // Un UUID partagé lie le débit marchand et le crédit client
  const sharedRef = crypto.randomUUID()
  await Promise.all([
    svc.from('wallet_ledger').insert({
      wallet_id:        merchantWallet.id,
      amount:           amountFcfa,
      currency_type:    'fcfa',
      transaction_type: 'agent_cashin_debit',
      reference_id:     sharedRef,
      balance_after:    merchantNewBalance,
    }),
    svc.from('wallet_ledger').insert({
      wallet_id:        clientWallet.id,
      amount:           amountFcfa,
      currency_type:    'fcfa',
      transaction_type: 'agent_cashin_credit',
      reference_id:     sharedRef,
      balance_after:    clientNewBalance,
    }),
  ])

  // Notification WA au client (non-bloquant)
  if (clientUser.phone) {
    sendWhatsApp(clientUser.phone, waAgentDepositClient({
      amount:     amountFcfa,
      agentName:  merchant.business_name,
      newBalance: clientNewBalance,
    })).catch(() => {})
  }

  return NextResponse.json({
    ok:             true,
    clientName:     clientUser.full_name,
    clientNewBalance,
    merchantNewBalance,
    ref: sharedRef,
  })
}
