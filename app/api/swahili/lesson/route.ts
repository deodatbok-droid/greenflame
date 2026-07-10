/**
 * GET /api/swahili/lesson?slug=biashara-1
 * Returns lesson + words + user progress for each word.
 * If no slug, returns the next recommended lesson for the user.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const svc = createServiceClient()
  const slug = req.nextUrl.searchParams.get('slug')

  // ── Fetch all lessons ──
  const { data: lessons } = await svc
    .from('swahili_lessons')
    .select('*')
    .order('position')

  if (!lessons?.length) {
    return NextResponse.json({ error: 'Aucune leçon disponible' }, { status: 404 })
  }

  let targetLesson = lessons.find(l => l.slug === slug)

  // If no slug or not found, pick next uncompleted lesson for logged-in user
  if (!targetLesson) {
    if (user) {
      const { data: completions } = await svc
        .from('user_swahili_completions')
        .select('lesson_id')
        .eq('user_id', user.id)
      const completedIds = new Set((completions ?? []).map(c => c.lesson_id))
      targetLesson = lessons.find(l => !completedIds.has(l.id)) ?? lessons[0]
    } else {
      targetLesson = lessons[0]
    }
  }

  // ── Fetch words for this lesson ──
  const { data: lessonWords } = await svc
    .from('swahili_lesson_words')
    .select('position, swahili_words(*)')
    .eq('lesson_id', targetLesson.id)
    .order('position')

  const words = (lessonWords ?? []).map(lw => lw.swahili_words).filter(Boolean)

  // ── Fetch user progress for these words (if logged in) ──
  let progressMap: Record<string, { repetitions: number; next_review_at: string }> = {}
  if (user && words.length > 0) {
    const wordIds = words.map((w: any) => w.id)
    const { data: progress } = await svc
      .from('user_swahili_progress')
      .select('word_id, repetitions, next_review_at')
      .eq('user_id', user.id)
      .in('word_id', wordIds)
    for (const p of progress ?? []) {
      progressMap[p.word_id] = { repetitions: p.repetitions, next_review_at: p.next_review_at }
    }
  }

  // ── Fetch user streak ──
  let streak = { current_streak: 0, xp_total: 0, words_learned: 0, lessons_completed: 0 }
  if (user) {
    const { data: s } = await svc
      .from('user_swahili_streaks')
      .select('current_streak, xp_total, words_learned, lessons_completed')
      .eq('user_id', user.id)
      .single()
    if (s) streak = s
  }

  return NextResponse.json({
    lesson: targetLesson,
    lessons: lessons.map(l => ({ id: l.id, slug: l.slug, title_fr: l.title_fr, title_en: l.title_en, emoji: l.emoji, level: l.level, theme: l.theme })),
    words,
    progressMap,
    streak,
    isLoggedIn: !!user,
  })
}
