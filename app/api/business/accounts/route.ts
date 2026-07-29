import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json() as { name?: string; country?: string }
  const { name, country = 'BJ' } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const svc  = createServiceClient()
  const slug = name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

  // Vérifier qu'il n'a pas déjà un business
  const { data: existing } = await svc
    .from('biz_members')
    .select('business_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Vous avez déjà un espace Business' }, { status: 409 })

  // Créer le compte business
  const { data: account, error: accErr } = await svc
    .from('biz_accounts')
    .insert({ name: name.trim(), slug: `${slug}-${Date.now().toString(36)}`, country, owner_id: user.id, plan: 'trial', status: 'active' })
    .select('id')
    .single()

  if (accErr || !account) return NextResponse.json({ error: accErr?.message ?? 'Erreur création' }, { status: 500 })

  // Ajouter le créateur comme owner
  await svc.from('biz_members').insert({ business_id: account.id, user_id: user.id, role: 'owner', permissions: {} })

  // Créer l'abonnement trial (30j)
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await svc.from('biz_subscriptions').insert({ business_id: account.id, plan: 'trial', status: 'trial', trial_ends_at: trialEnd })

  return NextResponse.json({ ok: true, business_id: account.id })
}
