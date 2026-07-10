/**
 * POST /api/merchant/wallet/withdraw
 *
 * Le marchand demande un retrait depuis son wallet boutique (merchant_wallets).
 * Flux :
 *   1. merchant_wallets débité atomiquement
 *   2. withdrawal_requests créé (source='merchant')
 *   3. Admin voit la demande et envoie le MoMo manuellement
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'

const MIN_AMOUNT = 1_000   // FCFA
const MAX_AMOUNT = 500_000 // FCFA

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Rate limit : 3 demandes/minute
  const LIMIT = 3
  const rl = checkRateLimit(`mwwithdraw:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  const svc = createServiceClient()

  // Vérifier que l'utilisateur est bien un marchand actif
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, is_active, business_name')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Compte marchand inactif' }, { status: 403 })
  }

  let body: { amount: number; operator: 'mtn_momo' | 'moov_money'; phone: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { amount, operator, phone } = body

  if (!amount || !operator || !phone?.trim()) {
    return NextResponse.json({ error: 'Montant, opérateur et téléphone requis' }, { status: 400 })
  }
  if (!['mtn_momo', 'moov_money'].includes(operator)) {
    return NextResponse.json({ error: 'Opérateur invalide' }, { status: 400 })
  }
  if (amount < MIN_AMOUNT) {
    return NextResponse.json({ error: `Minimum de retrait : ${MIN_AMOUNT.toLocaleString('fr-FR')} FCFA` }, { status: 400 })
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json({ error: `Maximum de retrait : ${MAX_AMOUNT.toLocaleString('fr-FR')} FCFA` }, { status: 400 })
  }

  const phoneNorm = normalizePhone(phone)

  // Appel RPC : débite merchant_wallets + crée la demande
  const { data: requestId, error: rpcErr } = await svc.rpc('request_merchant_withdrawal', {
    p_merchant_id: merchant.id,
    p_amount_fcfa: amount,
    p_operator:    operator,
    p_phone:       phoneNorm,
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 400 })
  }

  return NextResponse.json({
    ok:        true,
    requestId,
    message:   'Demande enregistrée. Votre virement sera traité sous 24h par l\'équipe GreenFlame.',
    amount,
    operator,
    phone:     phoneNorm,
  })
}
