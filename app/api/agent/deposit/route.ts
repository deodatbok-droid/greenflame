/**
 * POST /api/agent/deposit
 *
 * Le marchand-agent reçoit du cash de l'utilisateur et crédite son wallet perso.
 * Flux : merchant_wallets (float boutique) → wallets (wallet perso client) — 1:1, sans frais
 * Le marchand convertit son solde boutique GreenFlame en cash physique.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'
import { sendWhatsApp, ADMIN_PHONE, waAdminDeposit, waAgentDepositClient } from '@/lib/whatsapp/wasender'

const MIN_AMOUNT = 500        // FCFA
const MAX_AMOUNT = 300_000    // FCFA

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Rate limit : 10 opérations agent/minute par marchand
  const LIMIT = 10
  const rl = checkRateLimit(`agent_deposit:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  const svc = createServiceClient()

  // Vérifier que l'utilisateur est bien un marchand avec le service agent actif
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, agent_service_active, is_active')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Compte marchand inactif' }, { status: 403 })
  }
  if (!merchant?.agent_service_active) {
    return NextResponse.json({ error: 'Service agent non activé pour ce compte' }, { status: 403 })
  }

  let body: { userPhone: string; amount: number }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { userPhone, amount } = body

  if (!userPhone || !amount) {
    return NextResponse.json({ error: 'Téléphone et montant requis' }, { status: 400 })
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return NextResponse.json({
      error: `Montant entre ${MIN_AMOUNT.toLocaleString('fr-FR')} et ${MAX_AMOUNT.toLocaleString('fr-FR')} FCFA`
    }, { status: 400 })
  }

  // Trouver le client par téléphone
  const phoneNorm = normalizePhone(userPhone)
  const { data: targetUser } = await svc
    .from('users')
    .select('id, full_name')
    .eq('phone', phoneNorm)
    .single()

  if (!targetUser) {
    return NextResponse.json({ error: 'Aucun membre GreenFlame trouvé pour ce numéro' }, { status: 404 })
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ error: 'Impossible de s\'auto-créditer' }, { status: 400 })
  }

  // Récupérer le wallet boutique du marchand et le wallet perso du client
  const [merchantWalletRes, userWalletRes] = await Promise.all([
    svc.from('merchant_wallets').select('id, balance_fcfa').eq('merchant_id', merchant.id).single(),
    svc.from('wallets').select('id, balance_fcfa').eq('user_id', targetUser.id).single(),
  ])

  const merchantWallet = merchantWalletRes.data
  const userWallet     = userWalletRes.data

  if (!merchantWallet) return NextResponse.json({ error: 'Wallet boutique introuvable — contactez le support' }, { status: 404 })
  if (!userWallet)     return NextResponse.json({ error: 'Wallet client introuvable' }, { status: 404 })

  if (merchantWallet.balance_fcfa < amount) {
    return NextResponse.json({
      error: `Solde boutique insuffisant. Votre solde agent : ${merchantWallet.balance_fcfa.toLocaleString('fr-FR')} FCFA`
    }, { status: 400 })
  }

  // Transfert atomique
  const newMerchantBalance = merchantWallet.balance_fcfa - amount
  const newUserBalance     = userWallet.balance_fcfa + amount
  const now                = new Date().toISOString()

  // Débit wallet boutique marchand
  const { error: errMerchant } = await svc
    .from('merchant_wallets')
    .update({ balance_fcfa: newMerchantBalance, updated_at: now })
    .eq('id', merchantWallet.id)

  // Crédit wallet perso client
  const { error: errUser } = await svc
    .from('wallets')
    .update({ balance_fcfa: newUserBalance, updated_at: now })
    .eq('id', userWallet.id)

  if (errMerchant || errUser) {
    return NextResponse.json({ error: 'Erreur lors du transfert. Réessayez.' }, { status: 500 })
  }

  // Entrées ledger
  await Promise.all([
    // Ledger boutique (merchant_wallet_ledger)
    svc.from('merchant_wallet_ledger').insert({
      merchant_wallet_id: merchantWallet.id,
      amount:             -amount,
      transaction_type:   'agent_deposit_out',
      balance_after:      newMerchantBalance,
      notes:              `Dépôt agent → ${targetUser.full_name} (${phoneNorm})`,
    }),
    // Ledger perso client (wallet_ledger)
    svc.from('wallet_ledger').insert({
      wallet_id:        userWallet.id,
      amount:           amount,
      currency_type:    'fcfa',
      transaction_type: 'agent_deposit_in',
      balance_after:    newUserBalance,
      notes:            `Dépôt cash via agent ${merchant.business_name}`,
    }),
  ])

  // Alerte WhatsApp admin (non-bloquant)
  sendWhatsApp(ADMIN_PHONE, waAdminDeposit({
    agentName:   merchant.business_name,
    clientName:  targetUser.full_name,
    clientPhone: phoneNorm,
    amount,
  })).catch(() => {})

  // Notification WhatsApp au client (non-bloquant)
  sendWhatsApp(phoneNorm, waAgentDepositClient({
    amount,
    agentName:  merchant.business_name,
    newBalance: newUserBalance,
  })).catch(() => {})

  return NextResponse.json({
    ok:              true,
    amount,
    clientName:      targetUser.full_name,
    clientPhone:     phoneNorm,
    agentNewBalance: newMerchantBalance,
    message:         `${amount.toLocaleString('fr-FR')} FCFA crédités sur le compte de ${targetUser.full_name}`,
  })
}
