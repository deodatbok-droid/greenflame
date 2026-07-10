import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MIN_AMOUNT = 500
const VOUCHER_TTL_HOURS = 48

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans 0/O/I/1 pour éviter confusion
  let code = 'GF-'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { amountFcfa, note, recipientPhone } = await req.json()

  // Valider le montant
  if (!amountFcfa || amountFcfa < MIN_AMOUNT) {
    return NextResponse.json({ error: `Montant minimum : ${MIN_AMOUNT} FCFA` }, { status: 400 })
  }

  // Valider le téléphone destinataire
  if (!recipientPhone || typeof recipientPhone !== 'string' || recipientPhone.trim().length < 8) {
    return NextResponse.json({
      error: 'Le numéro de téléphone du destinataire est requis',
    }, { status: 400 })
  }

  const cleanPhone = recipientPhone.replace(/\D/g, '')

  const svc = createServiceClient()

  // Vérifier que le destinataire est membre GreenFlame
  const { data: recipientUser } = await svc
    .from('users')
    .select('id, full_name, phone')
    .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.00${cleanPhone}`)
    .maybeSingle()

  if (!recipientUser) {
    return NextResponse.json({
      error: 'Ce numéro n\'est pas inscrit sur GreenFlame. Invitez votre destinataire à s\'inscrire d\'abord.',
    }, { status: 422 })
  }

  // Le créateur ne peut pas s'envoyer un bon à lui-même
  if (recipientUser.id === user.id) {
    return NextResponse.json({
      error: 'Vous ne pouvez pas créer un bon pour vous-même',
    }, { status: 400 })
  }

  // Vérifier solde suffisant
  const { data: wallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!wallet || wallet.balance_fcfa < amountFcfa) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
  }

  // Générer un code unique
  let code: string = ''
  let attempts = 0
  while (attempts < 10) {
    code = generateCode()
    const { data: existing } = await svc
      .from('withdrawal_vouchers')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) break
    attempts++
  }
  if (!code) return NextResponse.json({ error: 'Impossible de générer un code unique' }, { status: 500 })

  const expiresAt = new Date(Date.now() + VOUCHER_TTL_HOURS * 3600 * 1000).toISOString()
  const newBalance = wallet.balance_fcfa - amountFcfa

  // Déduire du wallet (réservation)
  const { error: walletError } = await svc
    .from('wallets')
    .update({ balance_fcfa: newBalance })
    .eq('id', wallet.id)

  if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 })

  // Inscrire dans wallet_ledger
  await svc.from('wallet_ledger').insert({
    wallet_id:        wallet.id,
    amount:           -amountFcfa,
    currency_type:    'fcfa',
    transaction_type: 'voucher_reserve',
    balance_after:    newBalance,
  })

  // Créer le bon
  const { data: voucher, error: voucherError } = await svc
    .from('withdrawal_vouchers')
    .insert({
      sender_id:       user.id,
      amount_fcfa:     amountFcfa,
      code,
      note:            note?.trim() || null,
      expires_at:      expiresAt,
      recipient_phone: cleanPhone,
    })
    .select()
    .single()

  if (voucherError) {
    // Rembourser si l'insertion échoue
    await svc.from('wallets').update({ balance_fcfa: wallet.balance_fcfa }).eq('id', wallet.id)
    return NextResponse.json({ error: voucherError.message }, { status: 500 })
  }

  return NextResponse.json({
    voucher,
    recipientName: recipientUser.full_name,
  })
}

/** GET /api/vouchers/create?phone=XXXXXXXX — vérifier si un numéro est membre GreenFlame */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '')
  if (!phone || phone.length < 8) {
    return NextResponse.json({ valid: false })
  }

  const svc = createServiceClient()
  const { data: found } = await svc
    .from('users')
    .select('id, full_name')
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle()

  if (!found || found.id === user.id) {
    return NextResponse.json({ valid: false, name: null })
  }

  return NextResponse.json({ valid: true, name: found.full_name })
}
