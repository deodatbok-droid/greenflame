/**
 * distributeCommissions — helper partagé
 *
 * Utilisé par :
 *   - /api/transactions/confirm  (cash_confirmed)
 *   - /api/webhooks/momo         (mtn_momo / moov_money après succès)
 *
 * Règle métier wallet marchand :
 *   - cash_confirmed → marchand a le cash physique → merchant_wallets NON crédité
 *   - mtn_momo / moov_money → GreenFlame reçoit le MoMo → merchant_wallets crédité (revenu net)
 *   - wallet_gf → géré directement dans handleWalletGfPayment, ne passe pas ici
 */
import { calculateCommissions } from './calculate'
import { GOVERNANCE } from './constants'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAndAlertStock } from '@/lib/utils/stock-alert'
import { insertNotifications } from '@/lib/utils/notify'
import { maybeActivateAccount } from '@/lib/utils/activate-account'
import { sendWhatsApp, ADMIN_PHONE, waPaymentBuyer, waPaymentMerchant, waAdminTransaction, waDigitalProduct, waCommissionNetwork } from '@/lib/whatsapp/wasender'

export async function distributeCommissions(transactionId: string): Promise<{
  ok: boolean
  cashback: { amount: number; isGfp: boolean }
  error?: string
}> {
  const svc = createServiceClient()

  // Verrou atomique : transition processing|escrow → distributing via UPDATE RETURNING.
  // PostgreSQL garantit qu'un seul appelant concurrent obtient la ligne.
  // Si aucune ligne retournée → déjà distribué ou en cours → idempotent.
  const { data: tx } = await svc
    .from('transactions')
    .update({ status: 'distributing' })
    .in('status', ['processing', 'escrow'])
    .eq('id', transactionId)
    .select('id, merchant_id, buyer_id, amount_fcfa, commission_rate, commission_total, payment_method, product_id, merchants(total_gmv)')
    .single()

  if (!tx) {
    const { data: existing } = await svc
      .from('transactions').select('id').eq('id', transactionId).maybeSingle()
    if (!existing) return { ok: false, error: 'Transaction introuvable', cashback: { amount: 0, isGfp: false } }
    return { ok: true, cashback: { amount: 0, isGfp: false } }
  }

  // ── Activation de compte (premier achat sans parrain) ──
  // Doit se faire AVANT le calcul des commissions pour que les uplines
  // soient disponibles si l'acheteur vient d'être activé.
  await maybeActivateAccount(svc, tx.buyer_id, tx.merchant_id)

  // Réseau de l'acheteur (rechargé après activation potentielle)
  const { data: tree } = await svc
    .from('network_tree')
    .select('l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
    .eq('user_id', tx.buyer_id)
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
    const { data: uplineUsers } = await svc
      .from('users')
      .select('id, last_active_at, phone')
      .in('id', uplineIds)
    for (const u of uplineUsers ?? []) {
      activeStatuses[u.id] = (u.last_active_at ?? '') >= cutoff
      if (u.phone) uplinePhones[u.id] = u.phone
    }
  }

  // Calcul des commissions
  const result = calculateCommissions({
    transactionId,
    amountFcfa:     tx.amount_fcfa,
    commissionRate: tx.commission_rate,
    buyerId:        tx.buyer_id,
    merchantId:     tx.merchant_id,
    uplines,
    activeStatuses,
  })

  const now = new Date().toISOString()

  // ── Créditer le Fonds Récompenses/Événements (3%) ──
  if (result.rewardsFundAmount > 0) {
    await svc.from('rewards_fund_ledger').insert({
      transaction_id:  transactionId,
      amount_fcfa:     result.rewardsFundAmount,
      pool_recompenses: Math.floor(result.rewardsFundAmount * 0.30),
      pool_evenements:  Math.floor(result.rewardsFundAmount * 0.70),
      created_at:      now,
    })
  }

  // ── Comptabiliser les spillovers dans le ledger dédié ──
  const spilloverEntries = result.allocations.filter(a => a.distributionType === 'spillover' && a.amountFcfa > 0)
  if (spilloverEntries.length > 0) {
    await svc.from('spillover_ledger').insert(
      spilloverEntries.map(a => ({
        transaction_id: transactionId,
        amount_fcfa:    a.amountFcfa,
        network_level:  a.level,
        reason:         a.spilloverReason ?? 'orphan_level',
        created_at:     now,
      }))
    )
  }

  // ── Créditer chaque bénéficiaire (cashback + réseau) sur wallet perso ──
  for (const alloc of result.allocations) {
    if (!alloc.recipientId) continue  // platform fee, spillover ou rewards_fund → pas de wallet

    const { data: wallet } = await svc
      .from('wallets')
      .select('id, balance_fcfa, balance_gfp, total_earned_fcfa')
      .eq('user_id', alloc.recipientId)
      .single()
    if (!wallet) continue

    if (alloc.isGfp) {
      // Cashback < 50 FCFA → split entier FCFA + fraction GFP
      // ex: 7,5 FCFA → balance_fcfa += 7  ET  balance_gfp += 5  (0,5 × 10)
      const rawCashback = (tx.commission_total ?? result.totalCommission) * GOVERNANCE.CASHBACK_SHARE
      const fcfaPart = Math.floor(rawCashback)
      const gfpPart  = Math.round((rawCashback - fcfaPart) * GOVERNANCE.FCFA_TO_GFP_RATE)
      const newFcfaBalance = wallet.balance_fcfa + fcfaPart
      const newGfpBalance  = wallet.balance_gfp  + gfpPart
      await svc.from('wallets').update({
        balance_fcfa:      newFcfaBalance,
        balance_gfp:       newGfpBalance,
        total_earned_fcfa: (wallet.total_earned_fcfa ?? 0) + fcfaPart,
        updated_at:        now,
      }).eq('id', wallet.id)

      if (fcfaPart > 0) {
        await svc.from('wallet_ledger').insert({
          wallet_id:        wallet.id,
          amount:           fcfaPart,
          currency_type:    'fcfa',
          transaction_type: 'cashback',
          reference_id:     transactionId,
          balance_after:    newFcfaBalance,
        })
      }
      if (gfpPart > 0) {
        await svc.from('wallet_ledger').insert({
          wallet_id:        wallet.id,
          amount:           gfpPart,
          currency_type:    'gfp',
          transaction_type: 'cashback',
          reference_id:     transactionId,
          balance_after:    newGfpBalance,
        })
      }
    } else {
      const newBalance = wallet.balance_fcfa + alloc.amountFcfa
      await svc.from('wallets').update({
        balance_fcfa:      newBalance,
        total_earned_fcfa: (wallet.total_earned_fcfa ?? 0) + alloc.amountFcfa,
        updated_at:        now,
      }).eq('id', wallet.id)

      await svc.from('wallet_ledger').insert({
        wallet_id:        wallet.id,
        amount:           alloc.amountFcfa,
        currency_type:    'fcfa',
        transaction_type: alloc.distributionType === 'cashback' ? 'cashback' : 'commission_network',
        reference_id:     transactionId,
        balance_after:    newBalance,
      })

      // WhatsApp immédiat pour chaque niveau réseau (1-5) qui reçoit une commission
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

  // ── Créditer merchant_wallets pour les paiements MoMo ──
  // cash_confirmed : le marchand a le cash physique → pas de crédit digital
  // mtn_momo / moov_money : GreenFlame reçoit le MoMo → créditer le wallet boutique
  const isMomo = tx.payment_method === 'mtn_momo' || tx.payment_method === 'moov_money'
  if (isMomo) {
    const netRevenue = tx.amount_fcfa - (tx.commission_total ?? result.totalCommission)

    const { data: merchantWallet } = await svc
      .from('merchant_wallets')
      .select('id, balance_fcfa, total_earned_fcfa')
      .eq('merchant_id', tx.merchant_id)
      .single()

    if (merchantWallet) {
      const newMerchantBalance = merchantWallet.balance_fcfa + netRevenue
      await svc.from('merchant_wallets').update({
        balance_fcfa:      newMerchantBalance,
        total_earned_fcfa: (merchantWallet.total_earned_fcfa ?? 0) + netRevenue,
        updated_at:        now,
      }).eq('id', merchantWallet.id)

      await svc.from('merchant_wallet_ledger').insert({
        merchant_wallet_id: merchantWallet.id,
        amount:             netRevenue,
        transaction_type:   'sale_revenue',
        reference_id:       transactionId,
        balance_after:      newMerchantBalance,
        notes:              `Vente MoMo — net après ${(tx.commission_rate * 100).toFixed(0)}% frais marketing`,
      })
    }
  }

  // ── Audit trail commission_distributions ──
  await svc.from('commission_distributions').insert(
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

  // ── Marquer complétée ──
  await svc.from('transactions').update({
    status:       'completed',
    completed_at: now,
  }).eq('id', transactionId)

  // ── GMV marchand ──
  const merchantData = tx.merchants as unknown as { total_gmv: number } | null
  await svc.from('merchants').update({
    total_gmv: (merchantData?.total_gmv ?? 0) + tx.amount_fcfa,
  }).eq('id', tx.merchant_id)

  // ── last_active_at acheteur ──
  await svc.from('users').update({ last_active_at: now }).eq('id', tx.buyer_id)

  // ── Alerte stock + livraison produit numérique (non-bloquant) ──
  const txWithProduct = tx as typeof tx & { product_id?: string | null }
  if (txWithProduct.product_id) {
    checkAndAlertStock(txWithProduct.product_id, tx.merchant_id).catch(() => {})

    // Livraison par WhatsApp si produit numérique
    ;(async () => {
      try {
        const { data: product } = await svc
          .from('products')
          .select('digital_url, name')
          .eq('id', txWithProduct.product_id!)
          .single()
        if (product?.digital_url) {
          const { data: buyer } = await svc
            .from('users')
            .select('phone')
            .eq('id', tx.buyer_id)
            .single()
          if (buyer?.phone) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
            const fullUrl = product.digital_url.startsWith('http')
              ? product.digital_url
              : `${baseUrl}${product.digital_url}`
            sendWhatsApp(buyer.phone, waDigitalProduct({
              productName: product.name ?? 'Formation',
              url:         fullUrl,
            }))
          }
        }
      } catch { /* non-bloquant */ }
    })()
  }

  // ── Notifications (non-bloquant) ──
  const notifPayloads = result.allocations
    .filter(a => !!a.recipientId)
    .map(a => {
      if (a.distributionType === 'cashback') {
        return {
          userId:      a.recipientId!,
          type:        'cashback',
          title:       '🔥 Cashback reçu',
          body:        `+${a.amountFcfa.toLocaleString('fr-FR')} ${a.isGfp ? 'GFP' : 'FCFA'} crédités sur votre wallet. Votre achat vient de propulser 5 personnes dans votre communauté. Ubuntu en action. 🌍`,
          referenceId: transactionId,
        }
      }
      return {
        userId:      a.recipientId!,
        type:        'commission',
        title:       '💰 Dividende communauté',
        body:        `+${a.amountFcfa.toLocaleString('fr-FR')} FCFA — niveau ${a.level} de votre communauté. Un achat dans votre communauté vous a généré ce dividende. Ubuntu en action. 🌍`,
        referenceId: transactionId,
      }
    })
  insertNotifications(notifPayloads).catch(() => {})

  const cashbackAlloc = result.allocations.find(a => a.distributionType === 'cashback')

  // Notifications WhatsApp acheteur / marchand / admin (non-bloquant)
  ;(async () => {
    try {
      const [buyerRes, merchantRes] = await Promise.all([
        svc.from('users').select('full_name, phone').eq('id', tx.buyer_id).single(),
        svc.from('merchants').select('business_name, users(phone)').eq('id', tx.merchant_id).single(),
      ])
      const buyer = buyerRes.data
      const merch = merchantRes.data
      const ownerPhone = (merch?.users as unknown as { phone: string } | null)?.phone
      const methodLabel =
        tx.payment_method === 'cash_confirmed' ? 'Cash' :
        tx.payment_method === 'mtn_momo'       ? 'MTN MoMo' : 'Moov Money'
      const ref = transactionId.slice(0, 8).toUpperCase()

      if (buyer?.phone) {
        const { data: bw } = await svc.from('wallets').select('balance_fcfa').eq('user_id', tx.buyer_id).single()
        sendWhatsApp(buyer.phone, waPaymentBuyer({
          merchantName: merch?.business_name ?? 'Marchand',
          amount:       tx.amount_fcfa,
          cashback:     cashbackAlloc?.amountFcfa ?? 0,
          ref,
          solde:        bw?.balance_fcfa ?? 0,
        }))
      }
      if (ownerPhone) {
        sendWhatsApp(ownerPhone, waPaymentMerchant({
          amount:     tx.amount_fcfa,
          net:        tx.amount_fcfa - (tx.commission_total ?? result.totalCommission),
          buyerPhone: buyer?.phone ?? '???',
          ref,
        }))
      }
      sendWhatsApp(ADMIN_PHONE, waAdminTransaction({
        buyerName:    buyer?.full_name    ?? 'Inconnu',
        buyerPhone:   buyer?.phone        ?? '???',
        merchantName: merch?.business_name ?? 'Inconnu',
        amount:       tx.amount_fcfa,
        method:       methodLabel,
        ref,
      }))
    } catch { /* non-bloquant */ }
  })()

  return {
    ok: true,
    cashback: { amount: cashbackAlloc?.amountFcfa ?? 0, isGfp: cashbackAlloc?.isGfp ?? false },
  }
}
