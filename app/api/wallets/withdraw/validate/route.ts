import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyPin } from '@/lib/utils/pin'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { requestId, pin } = await req.json()
  if (!requestId || !pin) return NextResponse.json({ error: 'requestId et pin requis' }, { status: 400 })

  const svc = createServiceClient()

  // Charger la demande
  const { data: request } = await svc.from('withdrawal_requests')
    .select('id, user_id, amount_fcfa, currency_type, status')
    .eq('id', requestId)
    .eq('user_id', user.id)  // sécurité : l'utilisateur ne peut valider que ses propres demandes
    .single()

  if (!request) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (request.status !== 'pending_user_validation')
    return NextResponse.json({ error: 'Cette demande ne nécessite pas de validation' }, { status: 409 })

  // Vérifier le PIN
  const { data: profile } = await supabase.from('users').select('transaction_pin').eq('id', user.id).single()
  if (!profile?.transaction_pin) return NextResponse.json({ error: 'Aucun PIN configuré' }, { status: 400 })
  const pinValid = profile.transaction_pin.includes(':')
    ? verifyPin(pin, profile.transaction_pin)
    : profile.transaction_pin === pin
  if (!pinValid) return NextResponse.json({ error: 'Code PIN incorrect' }, { status: 401 })

  // Charger le wallet et vérifier le solde
  const { data: wallet } = await svc.from('wallets')
    .select('id, balance_fcfa, balance_gfp, total_earned_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 })

  const amountFcfa = request.amount_fcfa
  if (wallet.balance_fcfa < amountFcfa)
    return NextResponse.json({ error: `Solde insuffisant (${wallet.balance_fcfa} FCFA disponible)` }, { status: 400 })

  const newBalance = wallet.balance_fcfa - amountFcfa
  const now = new Date().toISOString()

  // Débiter le wallet
  await svc.from('wallets').update({
    balance_fcfa: newBalance,
    updated_at: now,
  }).eq('id', wallet.id)

  await svc.from('wallet_ledger').insert({
    wallet_id: wallet.id,
    amount: -amountFcfa,
    currency_type: 'fcfa',
    transaction_type: 'mobile_money_withdrawal',
    reference_id: requestId,
    balance_after: newBalance,
    notes: 'Retrait validé par l\'utilisateur (initié par admin)',
  })

  // Passer la demande à 'pending' pour traitement admin
  await svc.from('withdrawal_requests').update({
    status: 'pending',
    processed_at: null,
  }).eq('id', requestId)

  insertNotification({
    userId:      user.id,
    type:        'withdrawal_validated',
    title:       '✅ Retrait validé',
    body:        `Vous avez confirmé votre retrait de ${amountFcfa.toLocaleString('fr-FR')} FCFA. L'administration procèdera au virement sous 24h.`,
    referenceId: requestId,
  }).catch(() => {})

  return NextResponse.json({ ok: true, newBalance, message: 'Retrait validé. Traitement en cours sous 24h.' })
}
