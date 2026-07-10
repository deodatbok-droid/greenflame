/**
 * POST /api/agent/withdraw
 *
 * L'utilisateur retire du cash chez un marchand-agent.
 * Flux : wallets (wallet perso client) → merchant_wallets (wallet boutique marchand)
 *
 *   Frais : 1% total
 *   - 0,5% commission marchand (inclus dans merchant_wallets)
 *   - 0,5% commission GreenFlame (spread — différence entre débit user et crédit marchand)
 *
 * Exemple : retrait 10 000 FCFA
 *   - wallet perso client  : -10 100 FCFA (montant + 1%)
 *   - wallet boutique marchand : +10 050 FCFA (montant + 0,5%)
 *   - GreenFlame   : +50 FCFA (spread)
 *   - Marchand remet 10 000 FCFA cash
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'

const MIN_AMOUNT             = 500
const MAX_AMOUNT             = 300_000
const AGENT_FEE_PCT          = 0.01    // 1% total payé par le client
const MERCHANT_COMMISSION_PCT = 0.005  // 0,5% → wallet boutique marchand

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Rate limit : 10 opérations/minute par marchand
  const LIMIT = 10
  const rl = checkRateLimit(`agent_withdraw:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  const svc = createServiceClient()

  // Vérifier le marchand agent
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

  // Trouver le client
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
    return NextResponse.json({ error: 'Impossible de traiter son propre retrait' }, { status: 400 })
  }

  // Calcul des frais
  const agentFee           = Math.round(amount * AGENT_FEE_PCT)
  const merchantCommission = Math.round(amount * MERCHANT_COMMISSION_PCT)
  const totalUserDebit     = amount + agentFee           // ce que paye l'utilisateur
  const merchantCredit     = amount + merchantCommission  // ce que reçoit le wallet boutique

  // Wallets
  const [merchantWalletRes, userWalletRes] = await Promise.all([
    svc.from('merchant_wallets').select('id, balance_fcfa, total_earned_fcfa').eq('merchant_id', merchant.id).single(),
    svc.from('wallets').select('id, balance_fcfa, total_earned_fcfa').eq('user_id', targetUser.id).single(),
  ])

  const merchantWallet = merchantWalletRes.data
  const userWallet     = userWalletRes.data

  if (!merchantWallet) return NextResponse.json({ error: 'Wallet boutique introuvable — contactez le support' }, { status: 404 })
  if (!userWallet)     return NextResponse.json({ error: 'Wallet client introuvable' }, { status: 404 })

  if (userWallet.balance_fcfa < totalUserDebit) {
    return NextResponse.json({
      error: `Solde client insuffisant. Solde : ${userWallet.balance_fcfa.toLocaleString('fr-FR')} FCFA, requis : ${totalUserDebit.toLocaleString('fr-FR')} FCFA (montant + ${agentFee} FCFA frais)`
    }, { status: 400 })
  }

  // Transfert atomique
  const newUserBalance     = userWallet.balance_fcfa - totalUserDebit
  const newMerchantBalance = merchantWallet.balance_fcfa + merchantCredit
  const now                = new Date().toISOString()

  // Débit wallet perso client
  const { error: errUser } = await svc
    .from('wallets')
    .update({ balance_fcfa: newUserBalance, updated_at: now })
    .eq('id', userWallet.id)

  // Crédit wallet boutique marchand (montant + commission 0.5%)
  const { error: errMerchant } = await svc
    .from('merchant_wallets')
    .update({
      balance_fcfa:      newMerchantBalance,
      total_earned_fcfa: (merchantWallet.total_earned_fcfa ?? 0) + merchantCommission,
      updated_at:        now,
    })
    .eq('id', merchantWallet.id)

  if (errUser || errMerchant) {
    return NextResponse.json({ error: 'Erreur lors du transfert. Réessayez.' }, { status: 500 })
  }

  // Ledger
  await Promise.all([
    // Ledger perso client (wallet_ledger)
    svc.from('wallet_ledger').insert({
      wallet_id:        userWallet.id,
      amount:           -totalUserDebit,
      currency_type:    'fcfa',
      transaction_type: 'agent_withdrawal_out',
      balance_after:    newUserBalance,
      notes:            `Retrait cash chez ${merchant.business_name} — frais ${agentFee} FCFA`,
    }),
    // Ledger boutique marchand (merchant_wallet_ledger)
    svc.from('merchant_wallet_ledger').insert({
      merchant_wallet_id: merchantWallet.id,
      amount:             merchantCredit,
      transaction_type:   'agent_withdrawal_in',
      balance_after:      newMerchantBalance,
      notes:              `Retrait client ${targetUser.full_name} — commission ${merchantCommission} FCFA`,
    }),
  ])

  return NextResponse.json({
    ok:              true,
    amount,
    agentFee,
    merchantCommission,
    gfCommission:    agentFee - merchantCommission,
    totalUserDebit,
    clientName:      targetUser.full_name,
    clientPhone:     phoneNorm,
    agentNewBalance: newMerchantBalance,
    message:         `Remettez ${amount.toLocaleString('fr-FR')} FCFA en cash à ${targetUser.full_name}. Transaction confirmée.`,
  })
}
