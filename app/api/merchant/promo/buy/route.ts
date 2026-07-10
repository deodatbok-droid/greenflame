import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const PACKS: Record<number, number> = { 50: 500, 100: 800 }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null) as { pack_size?: number } | null
  const packSize = body?.pack_size
  if (!packSize || !PACKS[packSize]) {
    return NextResponse.json({ error: 'Pack invalide. Tailles disponibles : 50, 100' }, { status: 400 })
  }
  const price = PACKS[packSize]

  const svc = createServiceClient()

  const { data: merchant } = await svc
    .from('merchants')
    .select('id, subscription_tier, subscription_expires_at')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Profil marchand introuvable' }, { status: 404 })

  const isActive = merchant.subscription_tier !== 'free'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()
  if (!isActive) {
    return NextResponse.json({ error: 'Fonctionnalité réservée aux marchands Pro ou VIP actifs' }, { status: 403 })
  }

  const { data: wallet } = await svc
    .from('merchant_wallets')
    .select('id, balance_fcfa')
    .eq('merchant_id', merchant.id)
    .single()

  if (!wallet || wallet.balance_fcfa < price) {
    return NextResponse.json({
      error: `Solde insuffisant. Pack à ${price.toLocaleString('fr-FR')} FCFA, disponible : ${(wallet?.balance_fcfa ?? 0).toLocaleString('fr-FR')} FCFA`,
    }, { status: 402 })
  }

  // Déduire du wallet marchand
  const { error: walletErr } = await svc
    .from('merchant_wallets')
    .update({ balance_fcfa: wallet.balance_fcfa - price })
    .eq('id', wallet.id)
  if (walletErr) return NextResponse.json({ error: 'Erreur lors du débit du wallet' }, { status: 500 })

  // Lire le solde actuel pour additionner (pas écraser)
  const { data: existing } = await svc
    .from('promo_message_credits')
    .select('balance, total_used')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  const { error: creditErr } = await svc
    .from('promo_message_credits')
    .upsert({
      merchant_id: merchant.id,
      balance:     (existing?.balance ?? 0) + packSize,
      total_used:  existing?.total_used ?? 0,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'merchant_id' })

  if (creditErr) {
    await svc.from('merchant_wallets').update({ balance_fcfa: wallet.balance_fcfa }).eq('id', wallet.id)
    return NextResponse.json({ error: 'Erreur lors de l\'attribution des crédits' }, { status: 500 })
  }

  return NextResponse.json({
    ok:         true,
    pack_size:  packSize,
    price_fcfa: price,
    new_balance: (existing?.balance ?? 0) + packSize,
    message:    `Pack de ${packSize} messages activé. ${price.toLocaleString('fr-FR')} FCFA débités de votre wallet boutique.`,
  })
}
