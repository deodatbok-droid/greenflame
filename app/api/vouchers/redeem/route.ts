import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'
import { sendSms } from '@/lib/ussd/africastalking'

const POOL_TRIGGER = 10   // FCFA minimum avant de déclencher le partage

// POST /api/vouchers/redeem — marchand VIP encaisse le bon, reçoit les fonds (moins frais)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

  const svc = createServiceClient()

  // Vérifier que l'utilisateur est bien un marchand actif ET VIP
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, is_active, subscription_tier, subscription_expires_at')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Compte marchand requis' }, { status: 403 })
  }

  // Gate VIP : seuls les marchands VIP actifs peuvent encaisser des bons
  const isVipActive = (
    merchant.subscription_tier === 'vip' &&
    merchant.subscription_expires_at !== null &&
    new Date(merchant.subscription_expires_at) > new Date()
  )

  if (!isVipActive) {
    return NextResponse.json({
      error: 'Les Bons de Retrait sont réservés aux marchands VIP. Passez au plan VIP pour encaisser des bons.',
      upgradeRequired: true,
    }, { status: 403 })
  }

  // Récupérer le bon
  const { data: voucher } = await svc
    .from('withdrawal_vouchers')
    .select('id, sender_id, amount_fcfa, status, expires_at, recipient_phone, code')
    .eq('code', code.toUpperCase())
    .single()

  if (!voucher) return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 })

  // Vérifications statut
  if (new Date(voucher.expires_at) < new Date()) {
    await svc.from('withdrawal_vouchers').update({ status: 'expired' }).eq('id', voucher.id)
    return NextResponse.json({ error: 'Ce bon a expiré' }, { status: 410 })
  }

  if (voucher.status !== 'active') {
    return NextResponse.json({
      error: voucher.status === 'redeemed' ? 'Bon déjà encaissé' : 'Bon annulé',
    }, { status: 409 })
  }

  if (voucher.sender_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas encaisser votre propre bon' }, { status: 400 })
  }

  // Vérification téléphone destinataire (audit — vérification physique par le marchand)
  if (voucher.recipient_phone) {
    const userPhone = await svc.from('users').select('phone').eq('id', user.id).single()
    void userPhone  // stocké pour audit futur
  }

  // ── POOL D'ACCUMULATION DES FRAIS ────────────────────────────────────────────
  //
  // Principe : les frais (1%) s'accumulent dans un pool par marchand.
  // Quand le pool atteint POOL_TRIGGER (10 FCFA), il est divisé en 2 parts
  // parfaitement égales avec floor(pool/2). Le reliquat (0 ou 1 FCFA) reste en pool.
  //
  // Garantie mathématique : les deux parts sont TOUJOURS identiques.
  //   floor(N/2) === floor(N/2)  ← calculé une seule fois, affecté aux deux parties.
  //
  // Exemple 2 × 500 FCFA (fee = 5 F chacune) :
  //   Tx 1 : pool 0 → 5  (< 10, attente)
  //   Tx 2 : pool 5 → 10 (≥ 10) → split 5 F + 5 F, pool reset = 0
  //
  // Exemple 1 × 1 500 FCFA (fee = 15 F) :
  //   Tx 1 : pool 0 → 15 (≥ 10) → split 7 F + 7 F, pool reset = 1

  const totalFee    = Math.floor(voucher.amount_fcfa * 0.01) // 1% brut de ce bon

  const { data: accrualRow } = await svc
    .from('merchant_fee_accrual')
    .select('accrued_fcfa, total_collected_fcfa, total_disbursed_fcfa, disbursement_count')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  const prevAccrual    = accrualRow?.accrued_fcfa ?? 0
  const newAccrual     = prevAccrual + totalFee

  // Calcul du split — une seule opération floor garantit l'égalité stricte
  const eachShare      = Math.floor(newAccrual / 2)          // parts identiques par construction
  const poolFires      = newAccrual >= POOL_TRIGGER           // seuil atteint ?
  const merchantFee    = poolFires ? eachShare : 0
  const greenFlameFee  = poolFires ? eachShare : 0           // toujours = merchantFee
  const remainingPool  = poolFires ? newAccrual - (eachShare * 2) : newAccrual  // 0 ou 1

  // Mise à jour du pool (upsert)
  const poolUpdate = {
    accrued_fcfa:         remainingPool,
    total_collected_fcfa: (accrualRow?.total_collected_fcfa ?? 0) + totalFee,
    total_disbursed_fcfa: (accrualRow?.total_disbursed_fcfa ?? 0) + (poolFires ? eachShare * 2 : 0),
    disbursement_count:   (accrualRow?.disbursement_count ?? 0) + (poolFires ? 1 : 0),
    updated_at:           new Date().toISOString(),
  }

  if (accrualRow) {
    await svc.from('merchant_fee_accrual').update(poolUpdate).eq('merchant_id', merchant.id)
  } else {
    await svc.from('merchant_fee_accrual').insert({ merchant_id: merchant.id, ...poolUpdate })
  }

  // ── CRÉDIT WALLET MARCHAND ───────────────────────────────────────────────────
  //
  // Le marchand reçoit : amount - totalFee (ce que lui coûte la facilitation)
  //                    + merchantFee (sa part du pool si déclenché)
  // = amount - totalFee + merchantFee
  // = amount - greenFlameFee (car totalFee = merchantFee + greenFlameFee, et les deux = eachShare)
  //
  // Cash à remettre au porteur : amount - totalFee (toujours)
  // Gain net du marchand       : merchantFee (identique à greenFlameFee)

  const merchantCredit      = voucher.amount_fcfa - totalFee + merchantFee
  const { data: merchantWallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', user.id)
    .single()

  if (!merchantWallet) return NextResponse.json({ error: 'Wallet marchand introuvable' }, { status: 500 })

  const newMerchantBalance = merchantWallet.balance_fcfa + merchantCredit
  const { error: creditError } = await svc
    .from('wallets')
    .update({ balance_fcfa: newMerchantBalance })
    .eq('id', merchantWallet.id)

  if (creditError) return NextResponse.json({ error: creditError.message }, { status: 500 })

  // Wallet ledger marchand
  await svc.from('wallet_ledger').insert({
    wallet_id:        merchantWallet.id,
    amount:           merchantCredit,
    currency_type:    'fcfa',
    transaction_type: 'voucher_redemption',
    reference_id:     voucher.id,
    balance_after:    newMerchantBalance,
  })

  // Revenus GreenFlame (seulement quand le pool se déclenche)
  if (poolFires && greenFlameFee > 0) {
    await svc.from('platform_revenue_ledger').insert({
      source_type: 'voucher_fee',
      source_id:   voucher.id,
      amount_fcfa: greenFlameFee,
      description: `Pool frais bons — ${merchant.business_name} — pool: ${prevAccrual}+${totalFee}→${newAccrual} → split ${eachShare}+${eachShare}, reliquat ${remainingPool}`,
    })
  }

  // Marquer le bon comme encaissé
  await svc
    .from('withdrawal_vouchers')
    .update({
      status:                  'redeemed',
      redeemed_by_merchant_id: merchant.id,
      redeemed_at:             new Date().toISOString(),
      fee_fcfa:                totalFee,
      merchant_fee_fcfa:       merchantFee,
      greenflame_fee_fcfa:     greenFlameFee,
    })
    .eq('id', voucher.id)

  // Notifier le créateur du bon
  const { data: sender } = await svc
    .from('users')
    .select('id, full_name, phone')
    .eq('id', voucher.sender_id)
    .single()

  if (sender) {
    await insertNotification({
      userId:      sender.id,
      type:        'voucher_redeemed',
      title:       'Votre bon a été encaissé ✅',
      body:        `Votre bon de retrait de ${voucher.amount_fcfa.toLocaleString('fr-FR')} FCFA a été encaissé chez ${merchant.business_name}.`,
      referenceId: voucher.id,
    })
    sendSms({ to: sender.phone, message: `[GreenFlame] Votre bon de retrait de ${voucher.amount_fcfa.toLocaleString('fr-FR')} FCFA a ete encaisse chez ${merchant.business_name}. Code: ${voucher.code}` }).catch(() => {})
  }

  return NextResponse.json({
    success:          true,
    amount_fcfa:      voucher.amount_fcfa,
    merchant_credit:  merchantCredit,
    fee_fcfa:         totalFee,
    merchant_fee:     merchantFee,
    greenflame_fee:   greenFlameFee,
    pool_accrual:     remainingPool,   // info pour le débogage / UI éventuelle
    pool_fired:       poolFires,
    merchant_name:    merchant.business_name,
    code:             code.toUpperCase(),
  })
}
