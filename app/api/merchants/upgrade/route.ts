import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getMoMoAdapter } from '@/lib/mobile-money'
import { insertNotification } from '@/lib/utils/notify'
import { sendSubscriptionAlertEmail } from '@/lib/email'

const TIER_PRICES: Record<string, number> = {
  standard:    0,
  vip:         15000,
  vip_annual:  15000,
  agent:       0,
  pro:         10000,
  vip_upgrade: 5000,
}

const TIER_LABELS: Record<string, string> = {
  standard: 'Standard', vip: 'VIP', vip_annual: 'VIP Annuel', agent: 'Service Agent',
  pro: 'Pro', vip_upgrade: 'Upgrade VIP',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { tier = 'pro', operator, phone, payment_method } = body as {
      tier: 'pro' | 'vip' | 'vip_annual' | 'vip_upgrade' | 'agent'
      operator?: 'mtn_momo' | 'moov_money'
      phone?: string
      payment_method?: 'mtn_momo' | 'moov_money' | 'cash' | 'vip_free'
    }

    const isCash = payment_method === 'cash'
    const isVipFree = payment_method === 'vip_free'

    if (!['standard', 'vip', 'vip_annual', 'agent', 'pro', 'vip_upgrade'].includes(tier)) {
      return NextResponse.json({ error: 'Tier non disponible' }, { status: 400 })
    }
    if (!isCash && !isVipFree && !['mtn_momo', 'moov_money'].includes(operator ?? '')) {
      return NextResponse.json({ error: 'Opérateur invalide' }, { status: 400 })
    }

    // Récupérer le marchand
    const { data: merchant, error: mErr } = await supabase
      .from('merchants')
      .select('id, business_name, subscription_tier, subscription_expires_at, agent_service_active, is_platform_hub')
      .eq('user_id', user.id)
      .single()

    if (mErr || !merchant) {
      return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })
    }

    // Validations métier
    const now = new Date()
    const isProActive = merchant.subscription_tier === 'pro'
      && merchant.subscription_expires_at
      && new Date(merchant.subscription_expires_at) > now

    if (tier === 'vip_upgrade' && !isProActive) {
      return NextResponse.json({
        error: "L'upgrade à 5 000 FCFA est réservé aux abonnés Pro actifs. Souscrivez d'abord au plan Pro.",
      }, { status: 400 })
    }

    if (tier === 'agent' && merchant.agent_service_active) {
      return NextResponse.json({ error: 'Service Agent déjà activé sur ce compte' }, { status: 400 })
    }

    if (tier === 'agent' && !merchant.is_platform_hub) {
      const isVipActive = merchant.subscription_tier === 'vip'
        && merchant.subscription_expires_at !== null
        && new Date(merchant.subscription_expires_at) > now
      if (!isVipActive) {
        return NextResponse.json({
          error: 'Le Service Agent nécessite un abonnement VIP actif. Souscrivez d\'abord au plan VIP.',
        }, { status: 400 })
      }
    }

    // Free agent activation for VIP merchants
    if (isVipFree && tier === 'agent') {
      const isVipActiveForAgent = merchant.subscription_tier === 'vip'
        && merchant.subscription_expires_at !== null
        && new Date(merchant.subscription_expires_at) > now
      if (!isVipActiveForAgent && !merchant.is_platform_hub) {
        return NextResponse.json({ error: 'Plan VIP requis pour l\'activation gratuite du Service Agent.' }, { status: 400 })
      }
      const service = createServiceClient()
      await service.rpc('activate_agent_service', { p_merchant_id: merchant.id })
      const { data: upline } = await service
        .from('users')
        .select('id')
        .contains('role', ['platform_upline'])
        .single()
      if (upline) {
        void insertNotification({
          userId: upline.id,
          type:   'subscription_paid',
          title:  '🏦 Service Agent activé (VIP)',
          body:   `${merchant.business_name} a activé le Service Agent gratuitement (plan VIP).`,
          referenceId: merchant.id,
        })
      }
      return NextResponse.json({
        success: true,
        message: 'Service Agent activé ! Vous pouvez maintenant effectuer des dépôts et retraits pour vos clients.',
      })
    }

    const amount = TIER_PRICES[tier]

    // ── Cas espèces : notifier Déodat et confirmer la demande ──
    if (isCash) {
      const svc = createServiceClient()
      const { data: upline } = await svc
        .from('users')
        .select('id')
        .contains('role', ['platform_upline'])
        .single()

      if (upline) {
        void insertNotification({
          userId: upline.id,
          type:   'subscription_cash_request',
          title:  `💵 Demande ${TIER_LABELS[tier] ?? tier}`,
          body:   `${merchant.business_name} veut payer ${amount.toLocaleString('fr-FR')} FCFA en espèces pour le plan ${TIER_LABELS[tier] ?? tier}.${phone ? ` Tél: ${phone}` : ''}`,
          referenceId: merchant.id,
        })
        void sendSubscriptionAlertEmail({
          merchantName: merchant.business_name,
          tier,
          amount,
          method: 'cash',
          phone,
          status: 'pending_cash',
        })
      }

      return NextResponse.json({ success: true, message: 'Demande enregistrée.' })
    }

    const externalId = `sub-${merchant.id}-${Date.now()}`

    // Initier le paiement mobile money
    const adapter = getMoMoAdapter(operator!)
    const payment = await adapter.requestToPay({
      amount,
      currency: 'XOF',
      externalId,
      payerMsisdn: (phone ?? '').replace(/\D/g, ''),
      payerMessage: `Abonnement GreenFlame ${tier.toUpperCase()} - ${merchant.business_name}`,
      payeeNote: `GreenFlame subscription ${tier}`,
    })

    // En mode mock : confirmer directement
    // En prod : attendre le webhook MoMo → /api/webhooks/momo
    if (process.env.PAYMENT_MODE !== 'live') {
      await new Promise(resolve => setTimeout(resolve, 3000))
      const status = await adapter.getTransactionStatus(payment.referenceId)

      if (status.status === 'SUCCESSFUL') {
        const service = createServiceClient()

        if (tier === 'agent') {
          await service.rpc('activate_agent_service', { p_merchant_id: merchant.id })
        } else {
          const rpcTier = tier === 'vip_annual' ? 'vip' : tier
          await service.rpc('activate_merchant_subscription', {
            p_merchant_id: merchant.id,
            p_tier:        rpcTier,
            p_amount_fcfa: amount,
            p_payment_ref: payment.referenceId,
            p_method:      operator,
          })
          // Pour l'annuel, écraser l'expiry à 365 jours
          if (tier === 'vip_annual') {
            const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            await service
              .from('merchants')
              .update({ subscription_expires_at: expiresAt })
              .eq('id', merchant.id)
          }
        }

        // Notifier Déodat du paiement Momo réussi
        const { data: upline } = await service
          .from('users')
          .select('id')
          .contains('role', ['platform_upline'])
          .single()

        if (upline) {
          void insertNotification({
            userId: upline.id,
            type:   'subscription_paid',
            title:  `✅ Abonnement ${TIER_LABELS[tier] ?? tier} payé`,
            body:   `${merchant.business_name} a payé ${amount.toLocaleString('fr-FR')} FCFA via ${operator === 'mtn_momo' ? 'MTN MoMo' : 'Moov Money'} pour le plan ${TIER_LABELS[tier] ?? tier}.`,
            referenceId: merchant.id,
          })
          void sendSubscriptionAlertEmail({
            merchantName: merchant.business_name,
            tier,
            amount,
            method: operator!,
            phone,
            status: 'paid',
          })
        }

        const labels: Record<string, string> = {
          standard:    'Plan Standard activé ! Vous avez accès aux 10 produits, factures, devis et analytics.',
          vip:         'Plan VIP activé ! Vitrine publique, multi-caissier et gestion d\'entreprise débloqués.',
          vip_annual:  'Plan VIP Annuel activé ! 365 jours d\'accès — vitrine, multi-caissier et gestion d\'entreprise.',
          agent:       'Service Agent activé ! Vous pouvez maintenant effectuer des dépôts et retraits.',
          pro:         'Plan Pro activé !',
          vip_upgrade: 'Upgrade VIP confirmé !',
        }

        return NextResponse.json({
          success: true,
          tier,
          paymentRef: payment.referenceId,
          message: labels[tier] ?? `${tier.toUpperCase()} activé avec succès !`,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Paiement non abouti. Vérifiez votre solde et réessayez.',
        }, { status: 402 })
      }
    }

    // Mode live : retourner le referenceId, le webhook confirmera
    return NextResponse.json({
      success: true,
      pending: true,
      referenceId: payment.referenceId,
      message: 'Paiement initié. Confirmez sur votre téléphone.',
    })

  } catch (err) {
    console.error('[upgrade] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Vérifier le statut d'un paiement d'abonnement en attente */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const referenceId = searchParams.get('ref')
  const operator = searchParams.get('op') as 'mtn_momo' | 'moov_money' | null

  if (!referenceId || !operator) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const adapter = getMoMoAdapter(operator)
  const status = await adapter.getTransactionStatus(referenceId)

  return NextResponse.json({ status: status.status, referenceId })
}
