import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'
import { verifyPin } from '@/lib/utils/pin'
import { sendWhatsApp, ADMIN_PHONE, waAdminWithdrawal } from '@/lib/whatsapp/wasender'
import { GOVERNANCE } from '@/lib/commission-engine/constants'

// Plafond de retrait mensuel — gating sur l'identité vérifiée (kyc_level >= 1)
const MONTHLY_CAP_UNVERIFIED_FCFA = 50_000
const MONTHLY_CAP_VERIFIED_FCFA   = 500_000

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  // Rate limit par utilisateur : 3 demandes de retrait/minute (protection financière forte)
  const LIMIT = 3
  const rl = checkRateLimit(`withdraw:user:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte : ${LIMIT} demandes de retrait par minute. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  const { mode, operator, phone, pin } = await req.json()

  if (!['fcfa', 'gfp'].includes(mode))
    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })
  if (!['mtn_momo', 'moov_money'].includes(operator))
    return NextResponse.json({ error: 'Operateur invalide' }, { status: 400 })
  if (!phone?.trim())
    return NextResponse.json({ error: 'Numero de telephone requis' }, { status: 400 })

  const MIN_FCFA = 1000
  const MIN_GFP  = GOVERNANCE.GFP_MIN_WITHDRAWAL

  // Verifier le solde
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance_fcfa, balance_gfp')
    .eq('user_id', user.id)
    .single()

  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 })

  if (mode === 'fcfa' && wallet.balance_fcfa < MIN_FCFA)
    return NextResponse.json({ error: `Minimum de retrait : ${MIN_FCFA} FCFA` }, { status: 400 })
  if (mode === 'gfp' && wallet.balance_gfp < MIN_GFP)
    return NextResponse.json({ error: `Minimum de retrait : ${MIN_GFP} GFP` }, { status: 400 })

  const { data: userProfile } = await supabase
    .from('users')
    .select('transaction_pin, kyc_level')
    .eq('id', user.id)
    .single()

  let amount = mode === 'fcfa' ? wallet.balance_fcfa : wallet.balance_gfp
  const phoneNorm = normalizePhone(phone)

  // Plafond de retrait mensuel — 50 000 FCFA par défaut, 500 000 FCFA une fois
  // l'identité vérifiée (kyc_level >= 1). S'applique à l'équivalent FCFA du
  // retrait (les retraits en GFP sont convertis au taux GOVERNANCE.GFP_TO_FCFA_RATE
  // pour éviter qu'un retrait en GFP ne contourne le plafond).
  const isVerified = (userProfile?.kyc_level ?? 0) >= 1
  const monthlyCap = isVerified ? MONTHLY_CAP_VERIFIED_FCFA : MONTHLY_CAP_UNVERIFIED_FCFA

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const { data: monthWithdrawals } = await supabase
    .from('withdrawal_requests')
    .select('amount_fcfa, currency_type')
    .eq('user_id', user.id)
    .eq('source', 'personal')
    .neq('status', 'failed')
    .gte('created_at', monthStart.toISOString())

  const alreadyWithdrawnFcfaEquivalent = (monthWithdrawals ?? []).reduce((sum, r) => {
    const fcfaEquivalent = r.currency_type === 'gfp' ? r.amount_fcfa * GOVERNANCE.GFP_TO_FCFA_RATE : r.amount_fcfa
    return sum + fcfaEquivalent
  }, 0)

  const remainingFcfa = monthlyCap - alreadyWithdrawnFcfaEquivalent

  if (remainingFcfa <= 0) {
    return NextResponse.json({
      error: isVerified
        ? 'Plafond de retrait mensuel atteint (500 000 FCFA). Réessayez le mois prochain.'
        : 'Plafond de retrait mensuel atteint (50 000 FCFA pour un compte non vérifié). Vérifiez votre identité pour passer à 500 000 FCFA/mois, ou réessayez le mois prochain.'
    }, { status: 400 })
  }

  // Le retrait porte toujours sur le solde total du wallet (pas de montant
  // partiel saisi par l'utilisateur) — si ce solde dépasse l'allocation
  // restante du mois, on retire seulement jusqu'à l'allocation restante
  // plutôt que de bloquer totalement l'utilisateur.
  const amountFcfaEquivalent = mode === 'fcfa' ? amount : Math.round(amount * GOVERNANCE.GFP_TO_FCFA_RATE)
  if (amountFcfaEquivalent > remainingFcfa) {
    amount = mode === 'fcfa' ? remainingFcfa : Math.floor(remainingFcfa / GOVERNANCE.GFP_TO_FCFA_RATE)
  }

  if (mode === 'fcfa' && amount < MIN_FCFA)
    return NextResponse.json({
      error: `Il ne vous reste que ${amount.toLocaleString('fr-FR')} FCFA d'allocation ce mois-ci, sous le minimum de retrait (${MIN_FCFA} FCFA).`
    }, { status: 400 })
  if (mode === 'gfp' && amount < MIN_GFP)
    return NextResponse.json({
      error: `Il ne vous reste que l'équivalent de ${amount.toLocaleString('fr-FR')} GFP d'allocation ce mois-ci, sous le minimum de retrait (${MIN_GFP} GFP).`
    }, { status: 400 })

  // Verification du PIN de transaction
  if (!pin) return NextResponse.json({ error: 'Code PIN requis pour effectuer un retrait' }, { status: 400 })
  if (!userProfile?.transaction_pin) return NextResponse.json({ error: 'Aucun PIN configuré. Contactez le support.' }, { status: 400 })
  const pinValid = userProfile.transaction_pin.includes(':')
    ? verifyPin(pin, userProfile.transaction_pin)
    : userProfile.transaction_pin === pin
  if (!pinValid) return NextResponse.json({ error: 'Code PIN incorrect' }, { status: 401 })

  // Enregistrer la demande via RPC atomique (debit wallet + creation demande)
  const { data: requestId, error: rpcErr } = await supabase.rpc('request_withdrawal', {
    p_amount_fcfa: amount,
    p_currency_type: mode,
    p_operator: operator,
    p_phone: phoneNorm,
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 400 })
  }

  // Alerte WhatsApp admin (non-bloquant)
  ;(async () => {
    try {
      const { data: u } = await supabase.from('users').select('full_name').eq('id', user.id).single()
      sendWhatsApp(ADMIN_PHONE, waAdminWithdrawal({
        userName: u?.full_name ?? 'Inconnu',
        phone:    phoneNorm,
        amount,
        currency: mode,
        operator,
      }))
    } catch { /* non-bloquant */ }
  })()

  return NextResponse.json({
    success: true,
    requestId,
    message: 'Demande de retrait enregistree. Votre paiement sera traite sous 24h.',
    amount,
    currency: mode.toUpperCase(),
    operator,
    phone: phoneNorm,
  })
}
