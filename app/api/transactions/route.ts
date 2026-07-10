import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMoMoAdapter } from '@/lib/mobile-money/mock'
import { verifyPin } from '@/lib/utils/pin'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'
import { calculateCommissions } from '@/lib/commission-engine/calculate'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import { checkAndAlertStock } from '@/lib/utils/stock-alert'
import { analyzeTransactionFraud } from '@/lib/ai/fraud-detector'
import { maybeActivateAccount } from '@/lib/utils/activate-account'
import { sendWhatsApp, ADMIN_PHONE, waPaymentBuyer, waPaymentMerchant, waAdminTransaction, waDigitalProduct, waCommissionNetwork, waCashPending, waCashPendingBuyer } from '@/lib/whatsapp/wasender'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // Rate limit par utilisateur : 5 transactions/minute
  const LIMIT = 5
  const rl = checkRateLimit(`txn:user:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte : ${LIMIT} transactions par minute maximum. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  let body: {
    merchantId: string
    amountFcfa: number
    paymentMethod: 'mtn_momo' | 'moov_money' | 'celtiis' | 'wallet_gf' | 'cash_confirmed'
    payerMsisdn?: string
    idempotencyKey: string
    transactionPin?: string
    buyerPhone?: string
    cashbackDiscount?: number
    productId?: string
    deliveryType?: 'pickup' | 'delivery'
    deliveryAddress?: string
    deliveryFee?: number          // frais de livraison en FCFA (transaction séparée)
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { merchantId, amountFcfa, paymentMethod, payerMsisdn, idempotencyKey, transactionPin, buyerPhone, cashbackDiscount, productId, deliveryType, deliveryAddress } = body

  if (!merchantId || !amountFcfa || amountFcfa <= 0 || !idempotencyKey) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  if (amountFcfa < 100) {
    return NextResponse.json({ error: 'Montant minimum : 100 FCFA' }, { status: 400 })
  }

  // Resolve buyerId EN PREMIER — nécessaire pour la vérification PIN en mode proxy
  const service = createServiceClient()
  let buyerId = user.id

  if (buyerPhone) {
    const phoneNorm = normalizePhone(buyerPhone)
    const { data: buyerUser } = await service.from('users').select('id').eq('phone', phoneNorm).single()
    if (!buyerUser) {
      return NextResponse.json({ error: 'Client GreenFlame introuvable pour ce numéro' }, { status: 404 })
    }
    buyerId = buyerUser.id
  } else {
    const { count: profileCount } = await service
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('id', buyerId)
    if (!profileCount) {
      return NextResponse.json({
        error: 'Inscription incomplète. Finalisez votre profil pour effectuer un achat.',
      }, { status: 400 })
    }
  }

  // Vérifier le PIN wallet_gf
  // • Achat direct (pas de buyerPhone) → PIN de l'utilisateur connecté
  // • Achat assisté (buyerPhone fourni)  → PIN du CLIENT (buyerId) — le marchand lui tend son téléphone
  if (paymentMethod === 'wallet_gf') {
    if (!transactionPin) {
      return NextResponse.json({ error: 'Code PIN requis pour le paiement wallet' }, { status: 400 })
    }
    const pinOwnerId = buyerPhone ? buyerId : user.id
    const { data: pinOwner } = await service
      .from('users')
      .select('transaction_pin')
      .eq('id', pinOwnerId)
      .single()

    if (!pinOwner?.transaction_pin) {
      return NextResponse.json({
        error: buyerPhone
          ? 'Ce client n\'a pas encore configuré son PIN. Demandez-lui de le définir depuis son profil.'
          : 'Aucun PIN configuré. Définissez-le depuis votre profil.',
      }, { status: 400 })
    }
    const pinValid = pinOwner.transaction_pin.includes(':')
      ? verifyPin(transactionPin, pinOwner.transaction_pin)
      : pinOwner.transaction_pin === transactionPin
    if (!pinValid) {
      return NextResponse.json({ error: 'Code PIN incorrect' }, { status: 401 })
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PAIEMENT WALLET_GF : traitement natif (wallet perso → merchant_wallets)
  // On n'appelle pas l'Edge Function pour ce cas afin de garantir
  // la séparation des comptes perso/boutique dès maintenant.
  // ══════════════════════════════════════════════════════════════
  if (paymentMethod === 'wallet_gf') {
    return handleWalletGfPayment({
      service, buyerId, merchantId, amountFcfa, idempotencyKey, productId, cashbackDiscount,
    })
  }

  // ══════════════════════════════════════════════════════════════
  // CASH_CONFIRMED : créer la transaction en 'pending'
  // Le marchand confirmera la réception via /api/transactions/confirm
  // qui distribuera les commissions.
  // ══════════════════════════════════════════════════════════════
  if (paymentMethod === 'cash_confirmed') {
    return handleCashTransaction({ service, buyerId, merchantId, amountFcfa, idempotencyKey, productId, deliveryType, deliveryAddress })
  }

  // ══════════════════════════════════════════════════════════════
  // MOBILE MONEY : créer la transaction en 'processing' + initier MoMo
  // Le webhook /api/webhooks/momo distribuera les commissions à la confirmation.
  // ══════════════════════════════════════════════════════════════
  if (paymentMethod === 'mtn_momo' || paymentMethod === 'moov_money') {
    return handleMomoTransaction({ service, buyerId, merchantId, amountFcfa, idempotencyKey, paymentMethod, payerMsisdn, productId, deliveryType, deliveryAddress })
  }

  return NextResponse.json({ error: 'Méthode de paiement non supportée' }, { status: 400 })
}

// ──────────────────────────────────────────────────────────────────
// Cash confirmé : crée la transaction en 'pending'
// Le marchand confirme la réception → /api/transactions/confirm
// ──────────────────────────────────────────────────────────────────
async function handleCashTransaction({
  service, buyerId, merchantId, amountFcfa, idempotencyKey, productId, deliveryType, deliveryAddress,
}: {
  service: ReturnType<typeof createServiceClient>
  buyerId: string
  merchantId: string
  amountFcfa: number
  idempotencyKey: string
  productId?: string
  deliveryType?: 'pickup' | 'delivery'
  deliveryAddress?: string
}): Promise<NextResponse> {
  try {
    // Idempotency
    const { data: existing } = await service
      .from('transactions')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, transactionId: existing.id, idempotent: true })

    const { data: merchant } = await service
      .from('merchants')
      .select('commission_rate, is_active')
      .eq('id', merchantId)
      .single()
    if (!merchant?.is_active) return NextResponse.json({ error: 'Marchand inactif' }, { status: 400 })

    // Taux du produit s'il existe (prend le dessus sur le taux marchand)
    let effectiveCommissionRate = merchant.commission_rate
    if (productId) {
      const { data: prod } = await service
        .from('products')
        .select('commission_rate')
        .eq('id', productId)
        .maybeSingle()
      if (prod?.commission_rate != null) {
        effectiveCommissionRate = prod.commission_rate
      }
    }

    const commissionTotal = Math.floor(amountFcfa * effectiveCommissionRate)

    const { data: tx, error } = await service
      .from('transactions')
      .insert({
        merchant_id:      merchantId,
        buyer_id:         buyerId,
        amount_fcfa:      amountFcfa,
        commission_total: commissionTotal,
        commission_rate:  effectiveCommissionRate,
        status:           'pending',
        payment_method:   'cash_confirmed',
        idempotency_key:  idempotencyKey,
        product_id:       productId ?? null,
        delivery_type:    deliveryType ?? null,
        delivery_address: deliveryAddress ?? null,
        // cash_confirmed + delivery = paiement à la livraison, pas d'escrow
        // L'escrow n'est actif que pour MoMo/wallet_gf + delivery
      })
      .select('id')
      .single()

    if (error || !tx) return NextResponse.json({ error: 'Erreur création transaction' }, { status: 500 })

    // Analyse fraude IA (non-bloquant)
    analyzeTransactionFraud({ transactionId: tx.id, buyerId, merchantId, amountFcfa, paymentMethod: 'cash_confirmed' }).catch(() => {})

    // WhatsApp marchand + acheteur : paiement cash en attente de validation (non-bloquant)
    ;(async () => {
      try {
        const [buyerRes, merchantRes] = await Promise.all([
          service.from('users').select('phone').eq('id', buyerId).single(),
          service.from('merchants').select('business_name, users(phone)').eq('id', merchantId).single(),
        ])
        const merchantPhone = (merchantRes.data?.users as unknown as { phone: string } | null)?.phone
        const ref = tx.id.slice(0, 8).toUpperCase()
        if (merchantPhone) {
          sendWhatsApp(merchantPhone, waCashPending({
            amount:     amountFcfa,
            buyerPhone: buyerRes.data?.phone ?? '',
            ref,
          }))
        }
        if (buyerRes.data?.phone) {
          sendWhatsApp(buyerRes.data.phone, waCashPendingBuyer({
            merchantName: merchantRes.data?.business_name ?? 'Marchand',
            amount:       amountFcfa,
            ref,
          }))
        }
      } catch { /* non-bloquant */ }
    })()

    return NextResponse.json({ ok: true, transactionId: tx.id, status: 'pending' })
  } catch (err) {
    console.error('cash_confirmed error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────
// Mobile Money : crée la transaction en 'processing' + initie MoMo
// Le webhook /api/webhooks/momo distribue les commissions au succès
// ──────────────────────────────────────────────────────────────────
async function handleMomoTransaction({
  service, buyerId, merchantId, amountFcfa, idempotencyKey, paymentMethod, payerMsisdn, productId, deliveryType, deliveryAddress,
}: {
  service: ReturnType<typeof createServiceClient>
  buyerId: string
  merchantId: string
  amountFcfa: number
  idempotencyKey: string
  paymentMethod: 'mtn_momo' | 'moov_money'
  payerMsisdn?: string
  productId?: string
  deliveryType?: 'pickup' | 'delivery'
  deliveryAddress?: string
}): Promise<NextResponse> {
  if (!payerMsisdn) {
    return NextResponse.json({ error: 'Numéro Mobile Money requis' }, { status: 400 })
  }

  try {
    // Idempotency
    const { data: existing } = await service
      .from('transactions')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, transactionId: existing.id, idempotent: true })

    const { data: merchant } = await service
      .from('merchants')
      .select('commission_rate, is_active')
      .eq('id', merchantId)
      .single()
    if (!merchant?.is_active) return NextResponse.json({ error: 'Marchand inactif' }, { status: 400 })

    // Taux du produit s'il existe (prend le dessus sur le taux marchand)
    let effectiveCommissionRate = merchant.commission_rate
    if (productId) {
      const { data: prod } = await service
        .from('products')
        .select('commission_rate')
        .eq('id', productId)
        .maybeSingle()
      if (prod?.commission_rate != null) {
        effectiveCommissionRate = prod.commission_rate
      }
    }

    const commissionTotal = Math.floor(amountFcfa * effectiveCommissionRate)

    const { data: tx, error } = await service
      .from('transactions')
      .insert({
        merchant_id:      merchantId,
        buyer_id:         buyerId,
        amount_fcfa:      amountFcfa,
        commission_total: commissionTotal,
        commission_rate:  effectiveCommissionRate,
        status:           'processing',
        payment_method:   paymentMethod,
        idempotency_key:  idempotencyKey,
        product_id:       productId ?? null,
        delivery_type:    deliveryType ?? null,
        delivery_address: deliveryAddress ?? null,
      })
      .select('id')
      .single()

    if (error || !tx) return NextResponse.json({ error: 'Erreur création transaction' }, { status: 500 })

    // Analyse fraude IA (non-bloquant)
    analyzeTransactionFraud({ transactionId: tx.id, buyerId, merchantId, amountFcfa, paymentMethod }).catch(() => {})

    // Initier la demande MoMo
    const adapter = getMoMoAdapter(paymentMethod)
    const momoResult = await adapter.requestToPay({
      amount:       amountFcfa,
      currency:     'XOF',
      externalId:   idempotencyKey,
      payerMsisdn,
      payerMessage: `Paiement GreenFlame`,
      payeeNote:    `Transaction GreenFlame`,
    })

    return NextResponse.json({
      ok:            true,
      transactionId: tx.id,
      status:        'processing',
      momoReference: momoResult.referenceId,
      momoStatus:    momoResult.status,
    })
  } catch (err) {
    console.error('momo transaction error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────
// Gestion native des paiements wallet_gf
// Garantit la séparation wallet perso (acheteur) / merchant_wallets
// ──────────────────────────────────────────────────────────────────
async function handleWalletGfPayment({
  service,
  buyerId,
  merchantId,
  amountFcfa,
  idempotencyKey,
  productId,
  cashbackDiscount,
}: {
  service: ReturnType<typeof createServiceClient>
  buyerId: string
  merchantId: string
  amountFcfa: number
  idempotencyKey: string
  productId?: string
  cashbackDiscount?: number
}): Promise<NextResponse> {
  try {
    // 1. Charger le marchand et son commission_rate
    const { data: merchantRow } = await service
      .from('merchants')
      .select('id, commission_rate, total_gmv, is_active')
      .eq('id', merchantId)
      .single()

    if (!merchantRow?.is_active) {
      return NextResponse.json({ error: 'Marchand inactif' }, { status: 400 })
    }

    // Charger le taux du produit s'il existe (prend le dessus sur le taux marchand)
    let effectiveCommissionRate = merchantRow.commission_rate
    if (productId) {
      const { data: prod } = await service
        .from('products')
        .select('commission_rate')
        .eq('id', productId)
        .maybeSingle()
      if (prod?.commission_rate != null) {
        effectiveCommissionRate = prod.commission_rate
      }
    }

    // 2. Wallet perso de l'acheteur
    const { data: buyerWallet } = await service
      .from('wallets')
      .select('id, balance_fcfa, balance_gfp, total_spent_fcfa')
      .eq('user_id', buyerId)
      .single()

    if (!buyerWallet) {
      return NextResponse.json({ error: 'Wallet acheteur introuvable' }, { status: 404 })
    }

    // Montant effectif après cashback discount éventuel
    const effectiveDiscount = Math.min(cashbackDiscount ?? 0, buyerWallet.balance_gfp, Math.floor(amountFcfa * 0.5))
    const actualAmount = amountFcfa - effectiveDiscount

    if (buyerWallet.balance_fcfa < actualAmount) {
      return NextResponse.json({
        error: `Solde insuffisant. Solde : ${buyerWallet.balance_fcfa.toLocaleString('fr-FR')} FCFA, requis : ${actualAmount.toLocaleString('fr-FR')} FCFA`,
      }, { status: 400 })
    }

    // 3. Wallet boutique du marchand
    const { data: merchantWallet } = await service
      .from('merchant_wallets')
      .select('id, balance_fcfa, total_earned_fcfa')
      .eq('merchant_id', merchantId)
      .single()

    if (!merchantWallet) {
      return NextResponse.json({ error: 'Wallet boutique marchand introuvable' }, { status: 404 })
    }

    // 4. Calcul commissions (taux produit > taux marchand)
    const commissionRate = effectiveCommissionRate
    const commissionTotal = Math.floor(amountFcfa * commissionRate)
    const netRevenue = amountFcfa - commissionTotal  // ce que reçoit le marchand

    // 5. Activation de compte (premier achat sans parrain)
    // Doit se faire AVANT le calcul des commissions pour que les uplines
    // soient disponibles si l'acheteur vient d'être activé à l'instant.
    await maybeActivateAccount(service, buyerId, merchantId)

    // Réseau de l'acheteur (rechargé après activation potentielle)
    const { data: tree } = await service
      .from('network_tree')
      .select('l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
      .eq('user_id', buyerId)
      .maybeSingle()

    const uplines = {
      l1: tree?.l1_upline ?? null,
      l2: tree?.l2_upline ?? null,
      l3: tree?.l3_upline ?? null,
      l4: tree?.l4_upline ?? null,
      l5: tree?.l5_upline ?? null,
    }

    const uplineIds = Object.values(uplines).filter((v): v is string => !!v)
    const activeStatuses: Record<string, boolean> = {}
    const uplinePhones: Record<string, string> = {}
    if (uplineIds.length > 0) {
      const cutoff = new Date(Date.now() - GOVERNANCE.INACTIVITY_SPILLOVER_DAYS * 86_400_000).toISOString()
      const { data: uplineUsers } = await service
        .from('users')
        .select('id, last_active_at, phone')
        .in('id', uplineIds)
      for (const u of uplineUsers ?? []) {
        activeStatuses[u.id] = (u.last_active_at ?? '') >= cutoff
        if (u.phone) uplinePhones[u.id] = u.phone
      }
    }

    // Idempotency check
    const { data: existing } = await service
      .from('transactions')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, transactionId: existing.id, idempotent: true })
    }

    // 6. Créer la transaction
    const { data: tx, error: txErr } = await service
      .from('transactions')
      .insert({
        merchant_id:      merchantId,
        buyer_id:         buyerId,
        amount_fcfa:      amountFcfa,
        commission_total: commissionTotal,
        commission_rate:  commissionRate,
        status:           'completed',
        payment_method:   'wallet_gf',
        idempotency_key:  idempotencyKey,
        completed_at:     new Date().toISOString(),
        product_id:       productId ?? null,
        metadata:         { net_revenue: netRevenue, effective_discount: effectiveDiscount },
      })
      .select('id')
      .single()

    if (txErr || !tx) {
      return NextResponse.json({ error: 'Erreur création transaction' }, { status: 500 })
    }

    const transactionId = tx.id
    const now = new Date().toISOString()

    // 7. Calculer distributions commissions
    const result = calculateCommissions({
      transactionId,
      amountFcfa,
      commissionRate,
      buyerId,
      merchantId,
      uplines,
      activeStatuses,
    })

    // 8. Débit wallet perso acheteur
    const newBuyerBalance = buyerWallet.balance_fcfa - actualAmount
    const newBuyerPgf = buyerWallet.balance_gfp - effectiveDiscount
    await service.from('wallets').update({
      balance_fcfa:      newBuyerBalance,
      balance_gfp:       newBuyerPgf,
      total_spent_fcfa:  (buyerWallet.total_spent_fcfa ?? 0) + amountFcfa,
      updated_at:        now,
    }).eq('id', buyerWallet.id)

    await service.from('wallet_ledger').insert({
      wallet_id:        buyerWallet.id,
      amount:           -actualAmount,
      currency_type:    'fcfa',
      transaction_type: 'wallet_gf_payment',
      reference_id:     transactionId,
      balance_after:    newBuyerBalance,
      notes:            `Paiement wallet GreenFlame — marchand`,
    })

    // 9. Crédit wallet boutique marchand (revenu net)
    const newMerchantBalance = merchantWallet.balance_fcfa + netRevenue
    await service.from('merchant_wallets').update({
      balance_fcfa:      newMerchantBalance,
      total_earned_fcfa: (merchantWallet.total_earned_fcfa ?? 0) + netRevenue,
      updated_at:        now,
    }).eq('id', merchantWallet.id)

    await service.from('merchant_wallet_ledger').insert({
      merchant_wallet_id: merchantWallet.id,
      amount:             netRevenue,
      transaction_type:   'sale_revenue',
      reference_id:       transactionId,
      balance_after:      newMerchantBalance,
      notes:              `Vente wallet GreenFlame — net après ${(commissionRate * 100).toFixed(0)}% frais marketing`,
    })

    // 10. Distribuer les commissions (cashback + réseau)
    const cashbackAlloc = result.allocations.find(a => a.distributionType === 'cashback')

    for (const alloc of result.allocations) {
      if (!alloc.recipientId) continue  // spillover ou platform

      const { data: recipientWallet } = await service
        .from('wallets')
        .select('id, balance_fcfa, balance_gfp, total_earned_fcfa')
        .eq('user_id', alloc.recipientId)
        .single()
      if (!recipientWallet) continue

      if (alloc.isGfp) {
        // Cashback < 50 FCFA → split entier FCFA + fraction GFP
        // ex: 7,5 FCFA → balance_fcfa += 7  ET  balance_gfp += 5
        const rawCashback = result.totalCommission * GOVERNANCE.CASHBACK_SHARE
        const fcfaPart = Math.floor(rawCashback)
        const gfpPart  = Math.round((rawCashback - fcfaPart) * GOVERNANCE.FCFA_TO_GFP_RATE)
        const newFcfaBalance = recipientWallet.balance_fcfa + fcfaPart
        const newGfpBalance  = recipientWallet.balance_gfp  + gfpPart
        await service.from('wallets').update({
          balance_fcfa:      newFcfaBalance,
          balance_gfp:       newGfpBalance,
          total_earned_fcfa: (recipientWallet.total_earned_fcfa ?? 0) + fcfaPart,
          updated_at:        now,
        }).eq('id', recipientWallet.id)

        if (fcfaPart > 0) {
          await service.from('wallet_ledger').insert({
            wallet_id:        recipientWallet.id,
            amount:           fcfaPart,
            currency_type:    'fcfa',
            transaction_type: 'cashback',
            reference_id:     transactionId,
            balance_after:    newFcfaBalance,
          })
        }
        if (gfpPart > 0) {
          await service.from('wallet_ledger').insert({
            wallet_id:        recipientWallet.id,
            amount:           gfpPart,
            currency_type:    'gfp',
            transaction_type: 'cashback',
            reference_id:     transactionId,
            balance_after:    newGfpBalance,
          })
        }
      } else {
        const newBalance = recipientWallet.balance_fcfa + alloc.amountFcfa
        await service.from('wallets').update({
          balance_fcfa:      newBalance,
          total_earned_fcfa: (recipientWallet.total_earned_fcfa ?? 0) + alloc.amountFcfa,
          updated_at:        now,
        }).eq('id', recipientWallet.id)

        const txType = alloc.distributionType === 'cashback' ? 'cashback' : 'commission_network'
        await service.from('wallet_ledger').insert({
          wallet_id:        recipientWallet.id,
          amount:           alloc.amountFcfa,
          currency_type:    'fcfa',
          transaction_type: txType,
          reference_id:     transactionId,
          balance_after:    newBalance,
        })

        // WhatsApp immédiat pour chaque niveau réseau (1-5)
        if (alloc.distributionType === 'network' && alloc.amountFcfa > 0 && alloc.recipientId) {
          const phone = uplinePhones[alloc.recipientId]
          if (phone) {
            sendWhatsApp(phone, waCommissionNetwork({
              amountFcfa: alloc.amountFcfa,
              level:      alloc.level,
              newBalance,
              ref:        transactionId.slice(0, 8).toUpperCase(),
            })).catch(() => {})
          }
        }
      }
    }

    // 11. Commission distributions (audit trail)
    await service.from('commission_distributions').insert(
      result.allocations.map(a => ({
        transaction_id:    transactionId,
        recipient_id:      a.recipientId,
        level:             a.level,
        amount_fcfa:       a.amountFcfa,
        percentage:        a.percentage,
        distribution_type: a.distributionType,
        is_gfp:            a.isGfp,
      }))
    )

    // 12. Mise à jour GMV marchand
    await service.from('merchants').update({
      total_gmv: (merchantRow.total_gmv ?? 0) + amountFcfa,
    }).eq('id', merchantId)

    // 13. Mise à jour last_active_at acheteur
    await service.from('users').update({ last_active_at: now }).eq('id', buyerId)

    // 14. Alerte stock si produit concerné (non-bloquant)
    if (productId) {
      checkAndAlertStock(productId, merchantId).catch(() => {})
    }

    // 15. Auto-activer abonnement si produit déclencheur + livraison produit numérique
    if (productId) {
      const { data: product } = await service
        .from('products')
        .select('subscription_trigger, digital_url, name')
        .eq('id', productId)
        .single()

      // Livraison immédiate par WhatsApp si produit numérique (non-bloquant)
      if (product?.digital_url) {
        ;(async () => {
          try {
            const { data: buyer } = await service
              .from('users')
              .select('phone')
              .eq('id', buyerId)
              .single()
            if (buyer?.phone) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
              const fullUrl = product.digital_url!.startsWith('http')
                ? product.digital_url!
                : `${baseUrl}${product.digital_url!}`
              sendWhatsApp(buyer.phone, waDigitalProduct({
                productName: product.name ?? 'Formation',
                url:         fullUrl,
              }))
            }
          } catch { /* non-bloquant */ }
        })()
      }

      if (product?.subscription_trigger) {
        const { data: buyerMerchant } = await service
          .from('merchants')
          .select('id')
          .eq('user_id', buyerId)
          .maybeSingle()

        if (buyerMerchant) {
          await service.rpc('activate_merchant_subscription', {
            p_merchant_id: buyerMerchant.id,
            p_tier:        product.subscription_trigger,
            p_amount_fcfa: amountFcfa,
            p_payment_ref: idempotencyKey,
            p_method:      'wallet_gf',
          })
        }
      }
    }

    // Analyse fraude IA (non-bloquant)
    analyzeTransactionFraud({ transactionId, buyerId, merchantId, amountFcfa, paymentMethod: 'wallet_gf' }).catch(() => {})

    // Notifications WhatsApp acheteur / marchand / admin (non-bloquant)
    ;(async () => {
      try {
        const [buyerRes, merchantRes] = await Promise.all([
          service.from('users').select('full_name, phone').eq('id', buyerId).single(),
          service.from('merchants').select('business_name, users(phone)').eq('id', merchantId).single(),
        ])
        const buyer = buyerRes.data
        const merch = merchantRes.data
        const ownerPhone = (merch?.users as unknown as { phone: string } | null)?.phone
        const ref = transactionId.slice(0, 8).toUpperCase()
        const soldeAfter = buyerWallet.balance_fcfa - actualAmount

        if (buyer?.phone) {
          sendWhatsApp(buyer.phone, waPaymentBuyer({
            merchantName: merch?.business_name ?? 'Marchand',
            amount:       amountFcfa,
            cashback:     cashbackAlloc?.amountFcfa ?? 0,
            ref,
            solde:        soldeAfter,
          }))
        }
        if (ownerPhone) {
          sendWhatsApp(ownerPhone, waPaymentMerchant({
            amount:     amountFcfa,
            net:        netRevenue,
            buyerPhone: buyer?.phone ?? '???',
            ref,
          }))
        }
        sendWhatsApp(ADMIN_PHONE, waAdminTransaction({
          buyerName:    buyer?.full_name ?? 'Inconnu',
          buyerPhone:   buyer?.phone    ?? '???',
          merchantName: merch?.business_name ?? 'Inconnu',
          amount:       amountFcfa,
          method:       'Wallet GreenFlame',
          ref,
        }))
      } catch { /* non-bloquant */ }
    })()

    return NextResponse.json({
      ok:          true,
      transactionId,
      cashback: {
        amount: cashbackAlloc?.amountFcfa ?? 0,
        isGfp:  cashbackAlloc?.isGfp ?? false,
      },
      netRevenue,
      commissionTotal,
    })

  } catch (err) {
    console.error('wallet_gf payment error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('transactions')
    .select('*, merchants(business_name)', { count: 'exact' })
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count, page, limit })
}
