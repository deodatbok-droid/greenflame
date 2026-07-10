/**
 * POST /api/swahili/streak — record lesson completion
 * GET  /api/swahili/streak — get current streak & stats
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ current_streak: 0, xp_total: 0, words_learned: 0, lessons_completed: 0 })

  const svc = createServiceClient()
  const { data } = await svc
    .from('user_swahili_streaks')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? { current_streak: 0, xp_total: 0, words_learned: 0, lessons_completed: 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true })

  const { lessonId, score, xpEarned } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'lessonId requis' }, { status: 400 })

  const svc = createServiceClient()

  // Log completion (upsert — can replay a lesson)
  await svc.from('user_swahili_completions').upsert({
    user_id:      user.id,
    lesson_id:    lessonId,
    score:        score ?? 0,
    xp_earned:    xpEarned ?? 0,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,lesson_id' })

  // Increment lessons_completed on streak row
  const { data: streak } = await svc
    .from('user_swahili_streaks')
    .select('lessons_completed, xp_total')
    .eq('user_id', user.id)
    .single()

  if (streak) {
    await svc.from('user_swahili_streaks').update({
      lessons_completed: streak.lessons_completed + 1,
      xp_total:          streak.xp_total + (xpEarned ?? 0),
      updated_at:        new Date().toISOString(),
    }).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
