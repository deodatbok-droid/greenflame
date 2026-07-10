import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_MESSAGE_LENGTH = 280

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null) as { message?: string } | null
  const message = body?.message?.trim()
  if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` }, { status: 400 })
  }

  const svc = createServiceClient()

  // Charger le profil marchand avec slug pour le CTA boutique
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at, public_slug')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Profil marchand introuvable' }, { status: 404 })

  const isActive = merchant.subscription_tier !== 'free'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()
  if (!isActive) {
    return NextResponse.json({ error: 'Fonctionnalité réservée aux marchands Pro ou VIP actifs' }, { status: 403 })
  }

  // Vérifier le solde de crédits
  const { data: credits } = await svc
    .from('promo_message_credits')
    .select('balance, total_used')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  if (!credits || credits.balance <= 0) {
    return NextResponse.json({ error: 'Crédits épuisés. Achetez un pack pour continuer.' }, { status: 402 })
  }

  // Récupérer tous les acheteurs uniques de ce marchand
  const { data: buyers } = await svc
    .from('transactions')
    .select('buyer_id')
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')

  const allBuyerIds = [...new Set((buyers ?? []).map(t => t.buyer_id))]
  if (allBuyerIds.length === 0) {
    return NextResponse.json({ error: 'Aucun acheteur trouvé pour cette boutique' }, { status: 400 })
  }

  // Exclure les utilisateurs ayant opt-out pour ce marchand
  const { data: optOuts } = await svc
    .from('promo_opt_outs')
    .select('user_id')
    .eq('merchant_id', merchant.id)
    .in('user_id', allBuyerIds)

  const optedOutIds = new Set((optOuts ?? []).map(o => o.user_id))
  const targetIds = allBuyerIds.filter(id => !optedOutIds.has(id))

  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'Tous vos acheteurs ont désactivé vos notifications' }, { status: 400 })
  }

  // Limiter à ce que le solde permet
  const toNotify = targetIds.slice(0, credits.balance)
  const actionUrl = merchant.public_slug ? `/boutique/${merchant.public_slug}` : null

  // Insérer les notifications en batch
  const notifications = toNotify.map(uid => ({
    user_id:    uid,
    type:       'promo',
    title:      `🎁 Offre de ${merchant.business_name}`,
    body:       message,
    is_read:    false,
    action_url: actionUrl,
    reference_id: merchant.id,
  }))

  const { error: notifErr } = await svc.from('notifications').insert(notifications)
  if (notifErr) return NextResponse.json({ error: 'Erreur lors de l\'envoi des notifications' }, { status: 500 })

  // Décrémenter les crédits
  const used = toNotify.length
  await svc
    .from('promo_message_credits')
    .update({
      balance:    credits.balance - used,
      total_used: credits.total_used + used,
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchant.id)

  return NextResponse.json({
    ok:        true,
    sent:      used,
    remaining: credits.balance - used,
    message:   `Message envoyé à ${used} acheteur${used > 1 ? 's' : ''}.`,
  })
}
