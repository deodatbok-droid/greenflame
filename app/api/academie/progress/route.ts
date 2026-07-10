/**
 * POST /api/academie/progress — Sauvegarde la progression d'une formation
 * Body: { module: 'f1'|'f2'|'f3', simulator?: boolean, quiz_score?: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { refreshUserScore } from '@/lib/scoring/engine'
import { recordFlammeEvent } from '@/lib/flamme/engine'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json() as {
    module?: 'f1' | 'f2' | 'f3'
    simulator?: boolean
    quiz_score?: number
  }

  if (!body.module || !['f1', 'f2', 'f3'].includes(body.module)) {
    return NextResponse.json({ error: 'module requis (f1|f2|f3)' }, { status: 400 })
  }

  const svc = createServiceClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.simulator === true) {
    updates[`${body.module}_simulator`] = true
  }

  let justCertified = false
  if (body.quiz_score !== undefined && body.quiz_score >= 0 && body.quiz_score <= 5) {
    updates[`${body.module}_quiz_score`] = body.quiz_score
    if (body.quiz_score >= 3) {
      // Vérifier si déjà certifié pour éviter le doublon FA
      const { data: existing } = await svc
        .from('budget_formation_progress')
        .select(`${body.module}_cert_at`)
        .eq('user_id', user.id)
        .single()
      const alreadyCertified = !!(existing as Record<string, unknown>)?.[`${body.module}_cert_at`]
      if (!alreadyCertified) justCertified = true
      updates[`${body.module}_cert_at`] = new Date().toISOString()
    }
  }

  await svc.from('budget_formation_progress').upsert({
    user_id: user.id,
    ...updates,
  })

  await refreshUserScore(user.id)

  // FA Flamme : +2 FA à la première certification d'un module
  if (justCertified) {
    await recordFlammeEvent({
      userId: user.id,
      eventType: 'fa_academie_module',
      faDelta: 2, // ×2 pour les formations financières
      referenceType: 'academie_module',
      metadata: { module: body.module },
    }).catch(err => console.error('Flamme academie hook error (non-blocking):', err))
  }

  const { data: progress } = await svc
    .from('budget_formation_progress')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(progress)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data } = await svc
    .from('budget_formation_progress')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}
