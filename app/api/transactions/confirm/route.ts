import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { distributeCommissions } from '@/lib/commission-engine/distribute'
import { verifyPin } from '@/lib/utils/pin'
import { refreshUserScore } from '@/lib/scoring/engine'

// Merchant (or admin) calls this to confirm cash receipt and distribute commissions
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { transactionId: string; transactionPin?: string; buyerPin?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { transactionId, transactionPin, buyerPin } = body
  if (!transactionId) return NextResponse.json({ error: 'transactionId requis' }, { status: 400 })

  const service = createServiceClient()

  // Charger la transaction pour vérifier les droits
  const { data: tx } = await service
    .from('transactions')
    .select('id, buyer_id, merchant_id, status, payment_method, merchants(user_id)')
    .eq('id', transactionId)
    .single()

  if (!tx) return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })
  if (tx.status !== 'pending') return NextResponse.json({ error: `Statut invalide : ${tx.status}` }, { status: 409 })
  if (tx.payment_method !== 'cash_confirmed') {
    return NextResponse.json({ error: 'Seules les transactions cash peuvent être confirmées ici' }, { status: 400 })
  }

  // Autorisation : seul le marchand ou un admin peut confirmer
  const merchantUserId = (tx.merchants as unknown as { user_id: string } | null)?.user_id

  if (buyerPin) {
    // Mode proxy : le marchand initie mais c'est le PIN du CLIENT qui authentifie le consentement
    // Le marchand doit être authentifié (session) — son identité suffit comme initiateur
    if (user.id !== merchantUserId) {
      const { data: callerData } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (!callerData?.role?.includes('admin')) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }
    if (!tx.buyer_id) {
      return NextResponse.json({ error: 'Aucun acheteur associé à cette transaction' }, { status: 400 })
    }
    const { data: buyerUser } = await service
      .from('users')
      .select('transaction_pin')
      .eq('id', tx.buyer_id)
      .single()

    if (!buyerUser?.transaction_pin) {
      return NextResponse.json({ error: 'Ce client n\'a pas encore configuré son code PIN' }, { status: 400 })
    }
    const buyerPinValid = buyerUser.transaction_pin.includes(':')
      ? verifyPin(buyerPin, buyerUser.transaction_pin)
      : buyerUser.transaction_pin === buyerPin

    if (!buyerPinValid) {
      return NextResponse.json({ error: 'Code PIN du client incorrect' }, { status: 401 })
    }
  } else if (user.id === merchantUserId) {
    // Mode normal : c'est le marchand lui-même → PIN marchand obligatoire
    if (!transactionPin) {
      return NextResponse.json({ error: 'Code PIN requis pour confirmer la réception' }, { status: 400 })
    }
    const { data: merchantUser } = await service
      .from('users')
      .select('transaction_pin')
      .eq('id', user.id)
      .single()

    if (!merchantUser?.transaction_pin) {
      return NextResponse.json({
        error: 'Aucun code PIN défini. Configurez votre PIN depuis votre profil avant de confirmer.',
      }, { status: 400 })
    }

    const pinValid = merchantUser.transaction_pin.includes(':')
      ? verifyPin(transactionPin, merchantUser.transaction_pin)
      : merchantUser.transaction_pin === transactionPin

    if (!pinValid) {
      return NextResponse.json({ error: 'Code PIN incorrect' }, { status: 401 })
    }
  } else {
    // Pas le marchand → doit être admin
    const { data: callerData } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!callerData?.role?.includes('admin')) {
      return NextResponse.json({ error: 'Accès refusé — seul le marchand peut confirmer' }, { status: 403 })
    }
    // Admin confirmant à la place du marchand → pas de PIN requis
  }

  // Distribuer les commissions + marquer complétée
  const result = await distributeCommissions(transactionId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Erreur distribution' }, { status: 500 })
  }

  // Refresh scores en arrière-plan (fire & forget)
  const buyerId = (tx as any).buyer_id as string | undefined
  if (buyerId) refreshUserScore(buyerId).catch(() => {})
  if (merchantUserId) refreshUserScore(merchantUserId).catch(() => {})

  return NextResponse.json({
    ok:       true,
    cashback: result.cashback,
  })
}
