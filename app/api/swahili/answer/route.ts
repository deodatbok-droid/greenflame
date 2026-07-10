/**
 * POST /api/swahili/answer
 * Records an answer and updates spaced repetition (SM-2).
 * Body: { wordId, correct: boolean, lessonId? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// SM-2 algorithm — quality: 5=perfect, 3=correct with effort, 1=wrong
function sm2(
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  quality: number,
): { easeFactor: number; intervalDays: number; repetitions: number } {
  if (quality < 3) {
    return { easeFactor: Math.max(1.3, easeFactor - 0.2), intervalDays: 1, repetitions: 0 }
  }
  const newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  let newInterval: number
  if (repetitions === 0)      newInterval = 1
  else if (repetitions === 1) newInterval = 6
  else                        newInterval = Math.round(intervalDays * easeFactor)
  return { easeFactor: newEF, intervalDays: newInterval, repetitions: repetitions + 1 }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true }) // anonymous — no progress saved

  const { wordId, correct, lessonId } = await req.json()
  if (!wordId) return NextResponse.json({ error: 'wordId requis' }, { status: 400 })

  const svc = createServiceClient()
  const quality = correct ? 5 : 1
  const now = new Date()

  // Upsert progress
  const { data: existing } = await svc
    .from('user_swahili_progress')
    .select('ease_factor, interval_days, repetitions')
    .eq('user_id', user.id)
    .eq('word_id', wordId)
    .single()

  const prev = existing ?? { ease_factor: 2.5, interval_days: 1, repetitions: 0 }
  const { easeFactor, intervalDays, repetitions } = sm2(
    Number(prev.ease_factor), prev.interval_days, prev.repetitions, quality
  )
  const nextReview = new Date(now.getTime() + intervalDays * 86_400_000)

  await svc.from('user_swahili_progress').upsert({
    user_id:          user.id,
    word_id:          wordId,
    ease_factor:      easeFactor,
    interval_days:    intervalDays,
    repetitions,
    next_review_at:   nextReview.toISOString(),
    last_reviewed_at: now.toISOString(),
  }, { onConflict: 'user_id,word_id' })

  // Update streak & XP
  const xpEarned = correct ? 10 : 2
  const today = now.toISOString().split('T')[0]

  const { data: streak } = await svc
    .from('user_swahili_streaks')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!streak) {
    await svc.from('user_swahili_streaks').insert({
      user_id:            user.id,
      current_streak:     1,
      longest_streak:     1,
      last_activity_date: today,
      xp_total:           xpEarned,
      words_learned:      correct && !existing ? 1 : 0,
    })
  } else {
    const lastDate = streak.last_activity_date
    const isNewDay = lastDate !== today
    const dayDiff = lastDate
      ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86_400_000)
      : 999
    const newStreak = dayDiff <= 1 ? (isNewDay ? streak.current_streak + 1 : streak.current_streak) : 1
    const newWordsLearned = correct && !existing ? streak.words_learned + 1 : streak.words_learned

    await svc.from('user_swahili_streaks').update({
      current_streak:     newStreak,
      longest_streak:     Math.max(streak.longest_streak, newStreak),
      last_activity_date: today,
      xp_total:           streak.xp_total + xpEarned,
      words_learned:      newWordsLearned,
      updated_at:         now.toISOString(),
    }).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true, xpEarned, newWord: correct && !existing })
}
