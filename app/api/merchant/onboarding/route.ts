import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, subscription_tier, sector, sector_activated_at')
    .eq('user_id', user.id)
    .single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { data: onboarding } = await supabase
    .from('merchant_onboarding_responses')
    .select('*')
    .eq('merchant_id', merchant.id)
    .single()

  return NextResponse.json({
    merchant: {
      id: merchant.id,
      subscription_tier: merchant.subscription_tier,
      sector: merchant.sector,
      sector_activated_at: merchant.sector_activated_at,
    },
    onboarding: onboarding ?? null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, subscription_tier')
    .eq('user_id', user.id)
    .single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const isPro = ['pro', 'vip'].includes(merchant.subscription_tier ?? '')
  if (!isPro) {
    return NextResponse.json(
      { error: "Un abonnement Pro est requis pour activer l'outil sectoriel" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { sector, client_type, avg_basket, monthly_volume, main_challenges, seniority } = body

  if (!sector || !client_type || !avg_basket || !monthly_volume || !seniority) {
    return NextResponse.json({ error: 'Réponses incomplètes' }, { status: 400 })
  }
  if (!['B2C', 'B2B', 'mixed'].includes(client_type)) {
    return NextResponse.json({ error: 'client_type invalide' }, { status: 400 })
  }
  if (!['<10k', '10k-50k', '50k-200k', '>200k'].includes(avg_basket)) {
    return NextResponse.json({ error: 'avg_basket invalide' }, { status: 400 })
  }
  if (!['<10', '10-30', '30-100', '>100'].includes(monthly_volume)) {
    return NextResponse.json({ error: 'monthly_volume invalide' }, { status: 400 })
  }
  if (!['<6m', '6m-2y', '2y-5y', '>5y'].includes(seniority)) {
    return NextResponse.json({ error: 'seniority invalide' }, { status: 400 })
  }
  if (!Array.isArray(main_challenges) || main_challenges.length > 2) {
    return NextResponse.json({ error: 'main_challenges invalide (max 2)' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: onboarding, error: upsertError } = await supabase
    .from('merchant_onboarding_responses')
    .upsert(
      {
        merchant_id: merchant.id,
        sector,
        client_type,
        avg_basket,
        monthly_volume,
        main_challenges,
        seniority,
        tool_activated: true,
        activated_at: now,
      },
      { onConflict: 'merchant_id' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  await supabase
    .from('merchants')
    .update({ sector, sector_client_type: client_type, sector_activated_at: now })
    .eq('id', merchant.id)

  try {
    await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: 'feature_used',
      metadata: { feature: 'sector_tool_activated', sector, client_type, avg_basket, monthly_volume, seniority, main_challenges },
    })
  } catch { /* non bloquant */ }

  return NextResponse.json({ success: true, sector, activated_at: now, onboarding })
}
