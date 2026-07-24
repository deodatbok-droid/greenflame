import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndSaveMerchantReport } from '@/lib/ai/merchant-report'

// POST /api/merchant/generate-report — déclenche le rapport IA pour le mois en cours
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Aucun compte marchand' }, { status: 403 })

  const isHub = merchant.is_platform_hub ?? false
  const tier  = merchant.subscription_tier ?? 'free'
  const exp   = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  const isVip = isHub || (tier === 'vip' && exp !== null && exp > new Date())
  if (!isVip) return NextResponse.json({ error: 'Fonctionnalité réservée aux comptes VIP' }, { status: 403 })

  try {
    const reportId = await generateAndSaveMerchantReport(merchant.id)
    return NextResponse.json({ ok: true, reportId })
  } catch (err) {
    console.error('[generate-report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 },
    )
  }
}
