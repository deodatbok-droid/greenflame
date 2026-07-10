import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_SLUGS = ['salon', 'couture', 'btp', 'resto'] as const
type ToolSlug = typeof VALID_SLUGS[number]
type Plan = 'monthly' | 'annual'

const TOOL_PRICES: Record<ToolSlug, Record<Plan, number>> = {
  salon:   { monthly: 10000,  annual: 100000 },
  couture: { monthly: 10000,  annual: 100000 },
  btp:     { monthly: 10000,  annual: 100000 },
  resto:   { monthly: 25000,  annual: 250000 },
}

const PLAN_DAYS: Record<Plan, number> = {
  monthly: 30,
  annual:  365,
}

export async function POST(req: Request) {
  try {
    const { tool_slug, plan = 'monthly' } = await req.json() as { tool_slug: string; plan?: Plan }

    if (!VALID_SLUGS.includes(tool_slug as ToolSlug)) {
      return NextResponse.json({ error: 'Outil invalide' }, { status: 400 })
    }
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!merchant) return NextResponse.json({ error: 'Compte marchand requis' }, { status: 403 })

    const price = TOOL_PRICES[tool_slug as ToolSlug][plan]
    const days  = PLAN_DAYS[plan]

    const { data: existing } = await supabase
      .from('tool_subscriptions')
      .select('id, expires_at')
      .eq('merchant_id', merchant.id)
      .eq('tool_slug', tool_slug)
      .maybeSingle()

    const now = new Date()
    const isActive = existing?.expires_at && new Date(existing.expires_at) > now
    const baseDate = isActive ? new Date(existing!.expires_at) : now
    const newExpiry = new Date(baseDate)
    newExpiry.setDate(newExpiry.getDate() + days)

    if (existing) {
      const { data, error } = await supabase
        .from('tool_subscriptions')
        .update({ expires_at: newExpiry.toISOString(), amount_fcfa: price, plan })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('tool_subscriptions')
      .insert({
        merchant_id: merchant.id,
        tool_slug,
        expires_at: newExpiry.toISOString(),
        amount_fcfa: price,
        plan,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
