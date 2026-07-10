/**
 * /api/merchant/cashiers — Multi-caissier (VIP uniquement)
 *
 * GET    — liste les caissiers de la boutique
 * POST   — ajouter un caissier (par numéro de téléphone)
 * DELETE — retirer un caissier
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

async function getVipMerchant(userId: string) {
  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, subscription_tier, subscription_expires_at')
    .eq('user_id', userId)
    .single()

  if (!merchant) return null

  const isVip = merchant.subscription_tier === 'vip'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()

  return isVip ? merchant : null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchant = await getVipMerchant(user.id)
  if (!merchant) return NextResponse.json({ error: 'Fonctionnalité VIP uniquement' }, { status: 403 })

  const svc = createServiceClient()
  const { data: cashiers } = await svc
    .from('merchant_cashiers')
    .select('id, label, is_active, created_at, users(full_name, phone)')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: true })

  return NextResponse.json(cashiers ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchant = await getVipMerchant(user.id)
  if (!merchant) return NextResponse.json({ error: 'Fonctionnalité VIP uniquement' }, { status: 403 })

  const { phone, label } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })

  const svc = createServiceClient()

  // Trouver l'utilisateur GreenFlame
  const phoneNorm = normalizePhone(phone)
  const { data: targetUser } = await svc
    .from('users')
    .select('id, full_name')
    .eq('phone', phoneNorm)
    .single()

  if (!targetUser) {
    return NextResponse.json({ error: 'Aucun membre GreenFlame trouvé pour ce numéro' }, { status: 404 })
  }

  // Ne pas s'ajouter soi-même
  if (targetUser.id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous ajouter comme caissier' }, { status: 400 })
  }

  // Vérifier la limite (max 5 caissiers par boutique VIP)
  const { count } = await svc
    .from('merchant_cashiers')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchant.id)
    .eq('is_active', true)

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Limite atteinte : 5 caissiers maximum par boutique' }, { status: 400 })
  }

  const { data: cashier, error } = await svc
    .from('merchant_cashiers')
    .insert({
      merchant_id: merchant.id,
      user_id:     targetUser.id,
      label:       label?.trim() || `Caissier ${(count ?? 0) + 1}`,
    })
    .select('id, label, is_active, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce membre est déjà caissier dans votre boutique' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cashier, userName: targetUser.full_name })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchant = await getVipMerchant(user.id)
  if (!merchant) return NextResponse.json({ error: 'Fonctionnalité VIP uniquement' }, { status: 403 })

  const { cashierId } = await req.json()
  if (!cashierId) return NextResponse.json({ error: 'cashierId requis' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('merchant_cashiers')
    .delete()
    .eq('id', cashierId)
    .eq('merchant_id', merchant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
