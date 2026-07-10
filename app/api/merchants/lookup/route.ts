import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'

/**
 * Recherche un marchand par téléphone, nom ou slug.
 * GET /api/merchants/lookup?q=97000000   → recherche par phone
 * GET /api/merchants/lookup?q=boutique   → recherche par nom/slug
 * Accessible sans authentification (pour l'écran de paiement public).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Rate limit leger : 60/minute même pour visiteurs (anti-scraping)
  const key = user ? `merchant-lookup:${user.id}` : `merchant-lookup:anon:${req.headers.get('x-forwarded-for') ?? 'ip'}`
  const rl = checkRateLimit(key, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(60, rl) })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const svc = createServiceClient()

  // Détecter si la query ressemble à un numéro de téléphone (≥ 8 chiffres consécutifs)
  const digitsOnly = q.replace(/[\s\-().+]/g, '')
  const isPhoneLike = /^\d{8,}$/.test(digitsOnly)

  if (isPhoneLike) {
    // Recherche par numéro de téléphone du propriétaire du compte marchand
    const normalized = normalizePhone(digitsOnly)

    const { data: userRow } = await svc
      .from('users')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle()

    if (!userRow) return NextResponse.json({ results: [] })

    const { data: merchant } = await svc
      .from('merchants')
      .select('id, business_name, business_category, commission_rate, is_active, subscription_tier, subscription_expires_at')
      .eq('user_id', userRow.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!merchant) return NextResponse.json({ results: [] })

    return NextResponse.json({
      results: [{
        id:                merchant.id,
        business_name:     merchant.business_name,
        business_category: merchant.business_category,
        commission_rate:   merchant.commission_rate,
        is_active:         merchant.is_active,
        match_type:        'phone',
      }],
    })
  }

  // Recherche textuelle par nom ou slug (existant)
  const { data: merchants } = await svc
    .from('merchants')
    .select('id, business_name, business_category, commission_rate, is_active, public_slug')
    .eq('is_active', true)
    .or(`business_name.ilike.%${q}%,public_slug.ilike.%${q}%`)
    .limit(5)

  return NextResponse.json({
    results: (merchants ?? []).map(m => ({
      id:                m.id,
      business_name:     m.business_name,
      business_category: m.business_category,
      commission_rate:   m.commission_rate,
      is_active:         m.is_active,
      match_type:        'text',
    })),
  })
}
