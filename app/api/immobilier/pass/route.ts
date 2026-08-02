import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMoMoAdapter } from '@/lib/mobile-money'

const PASS_AMOUNT_FCFA = 500

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { operator, phone } = body as { operator?: 'mtn_momo' | 'moov_money'; phone?: string }

    if (!['mtn_momo', 'moov_money'].includes(operator ?? '')) {
      return NextResponse.json({ error: 'Opérateur invalide' }, { status: 400 })
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
    }

    const externalId = `buyerpass-${user.id}-${Date.now()}`
    const adapter = getMoMoAdapter(operator!)
    const payment = await adapter.requestToPay({
      amount: PASS_AMOUNT_FCFA,
      currency: 'XOF',
      externalId,
      payerMsisdn: phone.replace(/\D/g, ''),
      payerMessage: 'Pass chercheur GreenFlame Immobilier',
      payeeNote: 'Pass chercheur 500 FCFA/mois',
    })

    if (process.env.PAYMENT_MODE !== 'live') {
      await new Promise(resolve => setTimeout(resolve, 3000))
      const status = await adapter.getTransactionStatus(payment.referenceId)

      if (status.status === 'SUCCESSFUL') {
        const service = createServiceClient()
        await service.rpc('activate_buyer_pass', {
          p_user_id: user.id,
          p_amount_fcfa: PASS_AMOUNT_FCFA,
          p_payment_method: operator,
          p_payment_ref: payment.referenceId,
        })

        return NextResponse.json({
          success: true,
          paymentRef: payment.referenceId,
          message: 'Pass chercheur activé ! Vous pouvez maintenant contacter les démarcheurs et créer des alertes.',
        })
      }

      return NextResponse.json({
        success: false,
        error: 'Paiement non abouti. Vérifiez votre solde et réessayez.',
      }, { status: 402 })
    }

    return NextResponse.json({
      success: true,
      pending: true,
      referenceId: payment.referenceId,
      message: 'Paiement initié. Confirmez sur votre téléphone.',
    })

  } catch (err) {
    console.error('[immobilier/pass] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Vérifier le statut d'un pass (actif ou non) pour l'utilisateur connecté */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const service = createServiceClient()
  const { data: active } = await service.rpc('buyer_pass_active', { p_user_id: user.id })
  const { data: pass } = await service
    .from('buyer_passes')
    .select('status, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ active: active === true, expires_at: pass?.expires_at ?? null })
}
