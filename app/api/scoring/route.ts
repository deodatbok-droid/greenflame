/**
 * GET  /api/scoring — score courant de l'utilisateur connecté
 * POST /api/scoring — recalcule et sauvegarde le score
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { refreshUserScore } from '@/lib/scoring/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data } = await svc
    .from('user_scores')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!data) {
    const result = await refreshUserScore(user.id)
    return NextResponse.json({
      score: result.details.total,
      details: result.details,
      niveau: result.niveau,
      bnpl_eligible: result.bnpl.eligible,
      bnpl_plafond_fcfa: result.bnpl.plafond_fcfa,
    })
  }

  return NextResponse.json(data)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const result = await refreshUserScore(user.id)
  return NextResponse.json({
    score: result.details.total,
    details: result.details,
    niveau: result.niveau,
    bnpl_eligible: result.bnpl.eligible,
    bnpl_plafond_fcfa: result.bnpl.plafond_fcfa,
  })
}
