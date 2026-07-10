import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

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

  const { data: credits } = await svc
    .from('promo_message_credits')
    .select('balance, total_used')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  return NextResponse.json({
    merchant_id:  merchant.id,
    tier:         merchant.subscription_tier,
    tier_active:  isActive,
    balance:      credits?.balance ?? 0,
    total_used:   credits?.total_used ?? 0,
  })
}
