// Edge Function : process-transaction
// Orchestre le flow complet d'une transaction GreenFlame :
// 1. Validation
// 2. Initiation paiement mobile money
// 3. Calcul et distribution atomique des commissions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GOVERNANCE, validateGovernanceConstants } from '../_shared/governance.ts'

validateGovernanceConstants()

function roundDown(v: number) { return Math.floor(v) }

interface TransactionRequest {
  merchantId: string
  buyerId: string
  amountFcfa: number
  paymentMethod: 'mtn_momo' | 'moov_money' | 'wallet_gf' | 'cash_confirmed'
  payerMsisdn?: string
  idempotencyKey: string
  productId?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: TransactionRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { merchantId, buyerId, amountFcfa, paymentMethod, idempotencyKey, productId } = body

  if (!merchantId || !buyerId || !amountFcfa || amountFcfa <= 0 || !idempotencyKey) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  if (amountFcfa < 100) {
    return new Response(JSON.stringify({ error: 'Montant minimum : 100 FCFA' }), { status: 400 })
  }

  // IDEMPOTENCY CHECK
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (existing) {
    return new Response(JSON.stringify({ transactionId: existing.id, status: existing.status, idempotent: true }), { status: 200 })
  }

  // Récupérer le marchand et son taux de commission
  const { data: merchant, error: merchantErr } = await supabase
    .from('merchants')
    .select('id, commission_rate, is_active, user_id, total_gmv')
    .eq('id', merchantId)
    .single()

  if (merchantErr || !merchant) {
    return new Response(JSON.stringify({ error: 'Merchant not found' }), { status: 404 })
  }
  if (!merchant.is_active) {
    return new Response(JSON.stringify({ error: 'Merchant inactive' }), { status: 400 })
  }

  // Empêcher l'achat dans sa propre boutique
  if (merchant.user_id === buyerId) {
    return new Response(JSON.stringify({ error: 'Vous ne pouvez pas acheter dans votre propre boutique' }), { status: 400 })
  }

  // Récupérer l'acheteur
  const { data: buyer, error: buyerErr } = await supabase
    .from('users')
    .select('id, is_active, last_active_at, upline_id')
    .eq('id', buyerId)
    .single()

  if (buyerErr || !buyer) {
    return new Response(JSON.stringify({ error: 'Buyer not found' }), { status: 404 })
  }

  // Vérifier le solde wallet si paiement GF
  let buyerWalletPrecheck: { id: string; balance_fcfa: number } | null = null
  if (paymentMethod === 'wallet_gf') {
    const { data: wData } = await supabase
      .from('wallets')
      .select('id, balance_fcfa')
      .eq('user_id', buyerId)
      .single()
    if (!wData || wData.balance_fcfa < amountFcfa) {
      return new Response(JSON.stringify({ error: 'Solde insuffisant' }), { status: 400 })
    }
    buyerWalletPrecheck = wData
  }

  // Récupérer le network tree pour distribution des commissions
  const { data: networkTree } = await supabase
    .from('network_tree')
    .select('l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
    .eq('user_id', buyerId)
    .single()

  // Vérifier l'activité des uplines
  const uplineIds = [
    networkTree?.l1_upline,
    networkTree?.l2_upline,
    networkTree?.l3_upline,
    networkTree?.l4_upline,
    networkTree?.l5_upline,
  ].filter(Boolean) as string[]

  const activeStatuses: Record<string, boolean> = {}
  if (uplineIds.length > 0) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - GOVERNANCE.INACTIVITY_SPILLOVER_DAYS)

    const { data: uplineUsers } = await supabase
      .from('users')
      .select('id, last_active_at, is_active')
      .in('id', uplineIds)

    if (uplineUsers) {
      for (const u of uplineUsers) {
        const isActive = u.is_active && new Date(u.last_active_at) > cutoffDate
        activeStatuses[u.id] = isActive
      }
    }
  }

  // Taux de commission : override produit si fourni, sinon taux marchand
  let commissionRate = merchant.commission_rate
  if (productId) {
    const { data: product } = await supabase
      .from('products')
      .select('commission_rate')
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .single()
    if (product?.commission_rate !== null && product?.commission_rate !== undefined) {
      commissionRate = product.commission_rate
    }
  }

  // CALCUL DES COMMISSIONS
  const totalCommission = roundDown(amountFcfa * commissionRate)
  const platformFee = roundDown(totalCommission * GOVERNANCE.PLATFORM_SHARE)
  const cashbackAmount = roundDown(totalCommission * GOVERNANCE.CASHBACK_SHARE)
  const cashbackIsPgf = cashbackAmount < GOVERNANCE.PGF_CASH_MIN_THRESHOLD

  // Créer la transaction en statut 'pending'
  const { data: transaction, error: txErr } = await supabase
    .from('transactions')
    .insert({
      merchant_id: merchantId,
      buyer_id: buyerId,
      amount_fcfa: amountFcfa,
      commission_total: totalCommission,
      commission_rate: commissionRate,
      status: 'processing',
      payment_method: paymentMethod,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single()

  if (txErr || !transaction) {
    return new Response(JSON.stringify({ error: 'Failed to create transaction', detail: txErr?.message }), { status: 500 })
  }

  // DISTRIBUTION ATOMIQUE via RPC
  const distributions: Array<{
    transaction_id: string
    recipient_id: string | null
    level: number
    amount_fcfa: number
    percentage: number
    distribution_type: string
    is_pgf: boolean
  }> = []

  const spillovers: Array<{ transaction_id: string; amount_fcfa: number; reason: string }> = []

  // Platform (niveau 0)
  distributions.push({
    transaction_id: transaction.id,
    recipient_id: null,
    level: 0,
    amount_fcfa: platformFee,
    percentage: GOVERNANCE.PLATFORM_SHARE,
    distribution_type: 'platform',
    is_pgf: false,
  })

  // Cashback acheteur (niveau 6)
  distributions.push({
    transaction_id: transaction.id,
    recipient_id: buyerId,
    level: 6,
    amount_fcfa: cashbackAmount,
    percentage: GOVERNANCE.CASHBACK_SHARE,
    distribution_type: 'cashback',
    is_pgf: cashbackIsPgf,
  })

  // Distribution réseau L1-L5
  const levels = [
    { key: 'l1_upline', level: 1, rate: GOVERNANCE.NETWORK_LEVELS.L1 },
    { key: 'l2_upline', level: 2, rate: GOVERNANCE.NETWORK_LEVELS.L2 },
    { key: 'l3_upline', level: 3, rate: GOVERNANCE.NETWORK_LEVELS.L3 },
    { key: 'l4_upline', level: 4, rate: GOVERNANCE.NETWORK_LEVELS.L4 },
    { key: 'l5_upline', level: 5, rate: GOVERNANCE.NETWORK_LEVELS.L5 },
  ]

  for (const { key, level, rate } of levels) {
    const uplineId = networkTree?.[key as keyof typeof networkTree] as string | null
    const levelAmount = roundDown(totalCommission * rate)

    if (!uplineId || !activeStatuses[uplineId]) {
      spillovers.push({
        transaction_id: transaction.id,
        amount_fcfa: levelAmount,
        reason: !uplineId ? 'orphan_level' : 'inactive_kingmaker',
      })
      distributions.push({
        transaction_id: transaction.id,
        recipient_id: null,
        level: 7,
        amount_fcfa: levelAmount,
        percentage: rate,
        distribution_type: 'spillover',
        is_pgf: false,
      })
    } else {
      distributions.push({
        transaction_id: transaction.id,
        recipient_id: uplineId,
        level,
        amount_fcfa: levelAmount,
        percentage: rate,
        distribution_type: 'network',
        is_pgf: false,
      })
    }
  }

  // Remainder → spillover
  const allocatedSum = distributions.reduce((s, d) => s + d.amount_fcfa, 0)
  const remainder = totalCommission - allocatedSum
  if (remainder > 0) {
    spillovers.push({ transaction_id: transaction.id, amount_fcfa: remainder, reason: 'rounding' })
    distributions.push({
      transaction_id: transaction.id,
      recipient_id: null,
      level: 7,
      amount_fcfa: remainder,
      percentage: 0,
      distribution_type: 'spillover',
      is_pgf: false,
    })
  }

  // INSERT distributions
  const { error: distErr } = await supabase
    .from('commission_distributions')
    .insert(distributions)

  if (distErr) {
    await supabase.from('transactions').update({ status: 'failed' }).eq('id', transaction.id)
    return new Response(JSON.stringify({ error: 'Distribution failed', detail: distErr.message }), { status: 500 })
  }

  // Déduire le montant du wallet acheteur si paiement GF
  if (paymentMethod === 'wallet_gf' && buyerWalletPrecheck) {
    const newBal = buyerWalletPrecheck.balance_fcfa - amountFcfa
    await supabase.from('wallets').update({ balance_fcfa: newBal }).eq('id', buyerWalletPrecheck.id)
    await supabase.from('wallet_ledger').insert({
      wallet_id: buyerWalletPrecheck.id,
      amount: -amountFcfa,
      currency_type: 'fcfa',
      transaction_type: 'purchase_payment',
      reference_id: transaction.id,
      balance_after: newBal,
    })
  }

  // INSERT spillovers
  if (spillovers.length > 0) {
    await supabase.from('spillover_fund').insert(spillovers)
  }

  // MISE À JOUR WALLETS
  // Cashback acheteur
  const buyerWallet = await supabase
    .from('wallets')
    .select('id, balance_fcfa, balance_pgf')
    .eq('user_id', buyerId)
    .single()

  if (buyerWallet.data) {
    const walletId = buyerWallet.data.id
    if (cashbackIsPgf) {
      const newPgf = buyerWallet.data.balance_pgf + cashbackAmount
      await supabase.from('wallets').update({ balance_pgf: newPgf }).eq('id', walletId)
      await supabase.from('wallet_ledger').insert({
        wallet_id: walletId,
        amount: cashbackAmount,
        currency_type: 'pgf',
        transaction_type: 'cashback',
        reference_id: transaction.id,
        balance_after: newPgf,
      })
    } else {
      // ── CAGNOTTE : retenir 50 FCFA si premier cashback FCFA du mois ──────
      const POT_ID = '00000000-0000-0000-0000-000000000001'
      const POT_AMOUNT = 50
      const currentPeriod = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
      let potRetained = 0

      if (cashbackAmount >= POT_AMOUNT) {
        const { data: existingContrib } = await supabase
          .from('pot_contributions')
          .select('id')
          .eq('user_id', buyerId)
          .eq('period', currentPeriod)
          .single()

        if (!existingContrib) {
          potRetained = POT_AMOUNT
        }
      }

      const actualCashback = cashbackAmount - potRetained
      const newFcfa = buyerWallet.data.balance_fcfa + actualCashback
      await supabase.from('wallets').update({ balance_fcfa: newFcfa }).eq('id', walletId)
      await supabase.from('wallet_ledger').insert({
        wallet_id: walletId,
        amount: actualCashback,
        currency_type: 'fcfa',
        transaction_type: 'cashback',
        reference_id: transaction.id,
        balance_after: newFcfa,
      })

      if (potRetained > 0) {
        // Alimenter la cagnotte
        const { data: pot } = await supabase
          .from('community_pot')
          .select('current_balance_fcfa, total_contributed_fcfa')
          .eq('id', POT_ID)
          .single()

        if (pot) {
          await supabase.from('community_pot').update({
            current_balance_fcfa: (pot.current_balance_fcfa as number) + potRetained,
            total_contributed_fcfa: (pot.total_contributed_fcfa as number) + potRetained,
            updated_at: new Date().toISOString(),
          }).eq('id', POT_ID)
        }

        await supabase.from('pot_contributions').insert({
          user_id: buyerId,
          period: currentPeriod,
          amount_fcfa: potRetained,
          cashback_dist_id: null,
        })

        // Notifier l'acheteur (non-bloquant)
        try {
          const { data: buyerInfo } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', buyerId)
            .single()
          const nom = (buyerInfo as { full_name?: string } | null)?.full_name ?? 'Membre'
          await supabase.from('notifications').insert({
            user_id: buyerId,
            type: 'cagnotte_contribution',
            title: '50 FCFA versés à la cagnotte',
            body: `${nom}, vos 50 premiers FCFA de cashback de ${currentPeriod} ont été versés à la cagnotte communautaire GreenFlame. Merci de faire partie de la communauté !`,
            reference_id: transaction.id,
          })
        } catch (_) {}
      }
      // ─────────────────────────────────────────────────────────────────────
    }
  }

  // Commissions réseau
  const networkDist = distributions.filter(d => d.distribution_type === 'network' && d.recipient_id)
  for (const dist of networkDist) {
    const kw = await supabase
      .from('wallets')
      .select('id, balance_fcfa')
      .eq('user_id', dist.recipient_id!)
      .single()

    if (kw.data) {
      const newBal = kw.data.balance_fcfa + dist.amount_fcfa
      await supabase.from('wallets').update({ balance_fcfa: newBal }).eq('id', kw.data.id)
      await supabase.from('wallet_ledger').insert({
        wallet_id: kw.data.id,
        amount: dist.amount_fcfa,
        currency_type: 'fcfa',
        transaction_type: 'commission_network',
        reference_id: transaction.id,
        balance_after: newBal,
      })
    }
  }

  // Mettre à jour total_gmv du marchand
  await supabase
    .from('merchants')
    .update({ total_gmv: merchant.total_gmv + amountFcfa })
    .eq('id', merchantId)

  // AUTO-AFFILIATION : si acheteur sans upline, le rattacher au marchand (L1)
  if (!buyer.upline_id) {
    const { count: prevTxCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('status', 'completed')
      .neq('id', transaction.id)

    if ((prevTxCount ?? 0) === 0) {
      // C'est le premier achat — rattacher au user du marchand
      const merchantUserId = merchant.user_id

      // Récupérer le network_tree du marchand pour chaîner L2-L5
      const { data: merchantTree } = await supabase
        .from('network_tree')
        .select('l1_upline, l2_upline, l3_upline, l4_upline')
        .eq('user_id', merchantUserId)
        .single()

      // Mettre à jour users.upline_id
      await supabase.from('users').update({ upline_id: merchantUserId }).eq('id', buyerId)

      // Upsert network_tree pour l'acheteur
      await supabase.from('network_tree').upsert({
        user_id: buyerId,
        l1_upline: merchantUserId,
        l2_upline: merchantTree?.l1_upline ?? null,
        l3_upline: merchantTree?.l2_upline ?? null,
        l4_upline: merchantTree?.l3_upline ?? null,
        l5_upline: merchantTree?.l4_upline ?? null,
      }, { onConflict: 'user_id' })
    }
  }

  // Marquer la transaction comme complétée
  await supabase
    .from('transactions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', transaction.id)

  // ── FLAMME : attribuer 1 FA à l'acheteur (fa_purchase) ──────────────────
  try {
    await supabase.from('flamme_events').insert({
      user_id: buyerId,
      event_type: 'fa_purchase',
      fa_delta: 1,
      fau_delta: 0,
      reference_id: transaction.id,
      reference_type: 'transaction',
      metadata: { amount_fcfa: amountFcfa, merchant_id: merchantId },
    })
    // Upsert user_flammes avec incrément FA acheteur
    const { data: ufBuyer } = await supabase
      .from('user_flammes')
      .select('flammes_activite, flammes_autonomie')
      .eq('user_id', buyerId)
      .single()
    const newFaBuyer = (ufBuyer?.flammes_activite ?? 0) + 1
    const newFauBuyer = ufBuyer?.flammes_autonomie ?? 0
    await supabase.from('user_flammes').upsert({
      user_id: buyerId,
      flammes_activite: newFaBuyer,
      flammes_autonomie: newFauBuyer,
      score_flamme: Number((newFaBuyer + newFauBuyer * 0.5).toFixed(1)),
      last_fa_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Attribuer 1 FA à chaque kingmaker ayant reçu une commission réseau
    for (const dist of networkDist) {
      if (!dist.recipient_id) continue
      await supabase.from('flamme_events').insert({
        user_id: dist.recipient_id,
        event_type: 'fa_network_commission',
        fa_delta: 1,
        fau_delta: 0,
        reference_id: transaction.id,
        reference_type: 'commission_distribution',
        metadata: { level: dist.level, amount_fcfa: dist.amount_fcfa },
      })
      const { data: ufKm } = await supabase
        .from('user_flammes')
        .select('flammes_activite, flammes_autonomie')
        .eq('user_id', dist.recipient_id)
        .single()
      const newFaKm = (ufKm?.flammes_activite ?? 0) + 1
      const newFauKm = ufKm?.flammes_autonomie ?? 0
      await supabase.from('user_flammes').upsert({
        user_id: dist.recipient_id,
        flammes_activite: newFaKm,
        flammes_autonomie: newFauKm,
        score_flamme: Number((newFaKm + newFauKm * 0.5).toFixed(1)),
        last_fa_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  } catch (flammeErr) {
    // Non bloquant — la transaction est déjà complétée
    console.error('Flamme attribution error (non-blocking):', flammeErr)
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── PACK MYSTÈRE : détecter si ce produit est un pack et l'attribuer ───────
  if (productId) {
    try {
      const { data: packDef } = await supabase
        .from('pack_catalog')
        .select('id, tier, fa_guaranteed')
        .eq('marketplace_product_id', productId)
        .eq('is_active', true)
        .single()

      if (packDef) {
        // Tirage aléatoire pondéré selon rareté et tier
        const tierOrder = ['bronze', 'argent', 'or']
        const tierIdx = tierOrder.indexOf(packDef.tier)
        const accessibleTiers = tierOrder.slice(0, tierIdx + 1)

        const { data: catalogItems } = await supabase
          .from('pack_item_catalog')
          .select('id, rarity, availability_weight, name_fr')
          .in('min_tier', accessibleTiers)
          .eq('is_active', true)

        let selectedItem: { id: string; rarity: string; name_fr: string } | null = null
        if (catalogItems && catalogItems.length > 0) {
          const totalWeight = catalogItems.reduce((s: number, i: any) => s + i.availability_weight, 0)
          let rng = Math.random() * totalWeight
          for (const item of catalogItems) {
            rng -= item.availability_weight
            if (rng <= 0) { selectedItem = item; break }
          }
          if (!selectedItem) selectedItem = catalogItems[catalogItems.length - 1]
        }

        // Créer l'entrée mystery_pack_purchases
        const { data: purchase } = await supabase
          .from('mystery_pack_purchases')
          .insert({
            user_id: buyerId,
            pack_tier: packDef.tier,
            price_paid_fcfa: amountFcfa,
            fa_granted: packDef.fa_guaranteed,
            boost_active: false,
            boost_multiplier: 1.0,
            status: selectedItem ? 'opened' : 'purchased',
            opened_at: selectedItem ? new Date().toISOString() : null,
          })
          .select('id')
          .single()

        if (purchase && selectedItem) {
          await supabase.from('mystery_pack_items').insert({
            purchase_id: purchase.id,
            catalog_item_id: selectedItem.id,
            delivered: false,
          })
        }

        // Créditer les FA garantis
        if (packDef.fa_guaranteed > 0) {
          await supabase.from('flamme_events').insert({
            user_id: buyerId,
            event_type: 'fa_purchase',
            fa_delta: packDef.fa_guaranteed,
            fau_delta: 0,
            reference_id: transaction.id,
            reference_type: 'transaction',
            metadata: { pack_tier: packDef.tier, fa_source: 'pack_mystere' },
          })
          const { data: ufPack } = await supabase
            .from('user_flammes')
            .select('flammes_activite, flammes_autonomie')
            .eq('user_id', buyerId)
            .single()
          const newFaPack = (ufPack?.flammes_activite ?? 0) + packDef.fa_guaranteed
          const newFauPack = ufPack?.flammes_autonomie ?? 0
          await supabase.from('user_flammes').upsert({
            user_id: buyerId,
            flammes_activite: newFaPack,
            flammes_autonomie: newFauPack,
            score_flamme: Number((newFaPack + newFauPack * 0.5).toFixed(1)),
            last_fa_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        // Notifier l'utilisateur
        if (selectedItem) {
          await supabase.from('notifications').insert({
            user_id: buyerId,
            type: 'pack_mystere_revealed',
            title: `🎁 Pack ${packDef.tier} ouvert !`,
            body: `Vous avez obtenu : ${selectedItem.name_fr} (${selectedItem.rarity}). Consultez vos achats pour y accéder.`,
            reference_id: transaction.id,
          })
        }
      }
    } catch (packErr) {
      console.error('Pack mystère hook error (non-blocking):', packErr)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return new Response(JSON.stringify({
    success: true,
    transactionId: transaction.id,
    cashback: { amount: cashbackAmount, isPgf: cashbackIsPgf },
    commission: totalCommission,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
