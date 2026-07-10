/**
 * GET  /api/academie/budget-profile — profil budget de l'utilisateur
 * POST /api/academie/budget-profile — crée/met à jour le profil budget
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { refreshUserScore } from '@/lib/scoring/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data } = await svc
    .from('budget_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json() as Partial<{
    revenus_mensuels_fcfa: number
    enveloppe_besoins_pct: number
    enveloppe_epargne_pct: number
    enveloppe_libre_pct: number
    objectif_epargne_fcfa: number
    objectif_epargne_label: string
    objectif_epargne_date: string
    coussin_actuel_fcfa: number
    service_type: string
    tarif_moyen_fcfa: number
    prestations_par_semaine: number
  }>

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('budget_profiles')
    .upsert({
      user_id: user.id,
      ...body,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await refreshUserScore(user.id)
  return NextResponse.json(data)
}
