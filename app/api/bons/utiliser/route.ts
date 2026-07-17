/**
 * POST /api/bons/utiliser
 *
 * Utilise un bon d'achat GreenFlame chez un marchand (partiellement ou totalement).
 * Le paiement cash complémentaire est géré séparément par le flux transaction normal.
 *
 * Body: {
 *   code:         string   — code du bon (8 caractères)
 *   merchantId:   string   — UUID du marchand
 *   amountToUse:  number   — montant à imputer sur ce bon (FCFA entiers)
 *   transactionId?: string — UUID transaction associée (optionnel)
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code, merchantId, amountToUse, transactionId } = body

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code bon invalide' }, { status: 400 })
  }
  const amount = Number(amountToUse)
  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }
  if (!merchantId || typeof merchantId !== 'string') {
    return NextResponse.json({ error: 'Marchand requis' }, { status: 400 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()

  // Récupérer le bon
  const { data: bon } = await svc
    .from('vouchers')
    .select('id, owner_id, issued_by_id, remaining_fcfa, status, expires_at')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (!bon) {
    return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 })
  }

  if (bon.status === 'expired' || bon.status === 'cancelled') {
    return NextResponse.json({ error: 'Ce bon est expiré ou annulé' }, { status: 400 })
  }
  if (bon.status === 'used') {
    return NextResponse.json({ error: 'Ce bon a déjà été entièrement utilisé' }, { status: 400 })
  }
  if (bon.expires_at < now) {
    await svc.from('vouchers').update({ status: 'expired', updated_at: now }).eq('id', bon.id)
    return NextResponse.json({ error: 'Ce bon a expiré' }, { status: 400 })
  }

  // Seul le propriétaire ou l'émetteur peut l'utiliser
  if (bon.owner_id !== user.id && bon.issued_by_id !== user.id) {
    return NextResponse.json({ error: 'Vous n\'êtes pas le propriétaire de ce bon' }, { status: 403 })
  }
  if (amount > bon.remaining_fcfa) {
    return NextResponse.json({
      error: `Montant demandé (${amount} FCFA) supérieur au solde du bon (${bon.remaining_fcfa} FCFA)`,
      remaining: bon.remaining_fcfa,
    }, { status: 400 })
  }

  // Vérifier que le marchand existe
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name')
    .eq('id', merchantId)
    .maybeSingle()
  if (!merchant) {
    return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })
  }

  const remainingAfter = bon.remaining_fcfa - amount
  const newStatus      = remainingAfter === 0 ? 'used' : 'partially_used'

  await svc.from('vouchers').update({
    remaining_fcfa: remainingAfter,
    status:         newStatus,
    used_at:        newStatus === 'used' ? now : undefined,
    updated_at:     now,
  }).eq('id', bon.id)

  await svc.from('voucher_redemptions').insert({
    voucher_id:      bon.id,
    transaction_id:  transactionId ?? null,
    merchant_id:     merchantId,
    amount_used:     amount,
    remaining_after: remainingAfter,
    redeemed_at:     now,
  })

  return NextResponse.json({
    ok:            true,
    amountUsed:    amount,
    remainingFcfa: remainingAfter,
    bonStatus:     newStatus,
    merchant:      merchant.business_name,
  })
}
