'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale } from '@/components/providers/LocaleProvider'
import FlashCard from '@/components/swahili/FlashCard'
import MultipleChoice from '@/components/swahili/MultipleChoice'
import LessonComplete from '@/components/swahili/LessonComplete'

// ── Types ────────────────────────────────────────────────────────
interface Word {
  id: string
  swahili: string
  french: string
  english: string
  theme: string
  difficulty: number
  example_sw?: string | null
  example_fr?: string | null
}

interface Lesson {
  id: string
  slug: string
  title_fr: string
  title_en: string
  subtitle_fr?: string
  subtitle_en?: string
  emoji: string
  theme: string
  level: number
}

type Phase = 'lobby' | 'flashcard' | 'quiz' | 'complete'

// ── Helpers ──────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function buildOptions(word: Word, allWords: Word[], locale: 'fr' | 'en'): string[] {
  const correct = locale === 'fr' ? word.french : word.english
  const pool = shuffle(allWords.filter(w => w.id !== word.id))
    .slice(0, 3)
    .map(w => locale === 'fr' ? w.french : w.english)
  return shuffle([correct, ...pool])
}

// ── Streak badge ─────────────────────────────────────────────────
function StreakBar({ streak, xp }: { streak: number; xp: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-green-950/10 rounded-2xl border border-green-100">
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🔥</span>
        <span className="font-bold text-green-800 text-sm">{streak}</span>
        <span className="text-green-600 text-xs">jours</span>
      </div>
      <div className="w-px h-4 bg-green-200" />
      <div className="flex items-center gap-1.5">
        <span className="text-lg">⚡</span>
        <span className="font-bold text-amber-700 text-sm">{xp} XP</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function SwahiliClient() {
  const { locale } = useLocale()
  const lang = (locale as string) === 'en' ? 'en' : 'fr'
  const params = useSearchParams()
  const lessonParam = params.get('lesson')

  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [allWords, setAllWords] = useState<Word[]>([])
  const [streak, setStreak] = useState({ current_streak: 0, xp_total: 0, words_learned: 0 })
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Phase state
  const [phase, setPhase] = useState<Phase>('lobby')
  const [wordIndex, setWordIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)

  // ── Load lesson data ──────────────────────────────────────────
  const loadLesson = useCallback(async (slug?: string) => {
    setLoading(true)
    const url = slug ? `/api/swahili/lesson?slug=${slug}` : '/api/swahili/lesson'
    const res = await fetch(url)
    const data = await res.json()
    setCurrentLesson(data.lesson)
    setLessons(data.lessons ?? [])
    setWords(data.words ?? [])
    setAllWords(data.words ?? [])
    setStreak(data.streak ?? { current_streak: 0, xp_total: 0, words_learned: 0 })
    setIsLoggedIn(data.isLoggedIn ?? false)
    setPhase('lobby')
    setWordIndex(0)
    setCorrectCount(0)
    setXpEarned(0)
    setLoading(false)
  }, [])

  useEffect(() => { loadLesson(lessonParam ?? undefined) }, [lessonParam, loadLesson])

  // ── Flashcard handler ─────────────────────────────────────────
  const handleFlashcard = async (correct: boolean) => {
    const word = words[wordIndex]
    if (isLoggedIn) {
      fetch('/api/swahili/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: word.id, correct }),
      }).catch(() => {})
    }
    if (correct) setCorrectCount(c => c + 1)
    setXpEarned(x => x + (correct ? 10 : 2))

    if (wordIndex + 1 < words.length) {
      setWordIndex(i => i + 1)
    } else {
      // All flashcards done → move to quiz
      setWordIndex(0)
      setPhase('quiz')
    }
  }

  // ── Quiz handler ──────────────────────────────────────────────
  const handleQuiz = async (correct: boolean) => {
    const word = words[wordIndex]
    if (isLoggedIn) {
      fetch('/api/swahili/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: word.id, correct }),
      }).catch(() => {})
    }
    if (correct) setCorrectCount(c => c + 1)
    setXpEarned(x => x + (correct ? 10 : 2))

    if (wordIndex + 1 < words.length) {
      setWordIndex(i => i + 1)
    } else {
      // Lesson complete
      const finalXp = xpEarned + (correct ? 10 : 2)
      if (isLoggedIn && currentLesson) {
        const totalQuestions = words.length * 2
        const totalCorrect = correctCount + (correct ? 1 : 0)
        const score = Math.round((totalCorrect / totalQuestions) * 100)
        fetch('/api/swahili/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: currentLesson.id, score, xpEarned: finalXp }),
        }).catch(() => {})
      }
      setPhase('complete')
    }
  }

  // ── Next lesson ───────────────────────────────────────────────
  const nextLesson = currentLesson
    ? lessons.find(l => l.id !== currentLesson.id && lessons.indexOf(l) > lessons.findIndex(l2 => l2.id === currentLesson.id))
    : null

  // ── Progress bar ──────────────────────────────────────────────
  const totalSteps = words.length * 2
  const currentStep = phase === 'flashcard' ? wordIndex
    : phase === 'quiz' ? words.length + wordIndex
    : phase === 'complete' ? totalSteps : 0
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0

  // ── Score for complete screen ─────────────────────────────────
  const totalQuestions = words.length * 2
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🌍</div>
          <p className="text-gray-500 text-sm">Chargement des leçons…</p>
        </div>
      </div>
    )
  }

  // ── LOBBY — lesson picker ─────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Back */}
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3">🌍</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === 'fr' ? 'Apprends le Swahili' : 'Learn Swahili'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {lang === 'fr' ? 'La langue panafricaine — par et pour l\'Afrique' : 'The pan-African language — by and for Africa'}
          </p>
        </div>

        {/* Streak */}
        <div className="flex justify-center">
          <StreakBar streak={streak.current_streak} xp={streak.xp_total} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
            <p className="text-2xl font-bold text-green-700">{streak.words_learned}</p>
            <p className="text-xs text-green-600">{lang === 'fr' ? 'mots appris' : 'words learned'}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
            <p className="text-2xl font-bold text-amber-600">{lessons.length}</p>
            <p className="text-xs text-amber-600">{lang === 'fr' ? 'leçons disponibles' : 'lessons available'}</p>
          </div>
        </div>

        {/* Ubuntu quote */}
        <div className="bg-green-950 rounded-2xl px-6 py-4 text-center">
          <p className="text-amber-300 text-sm italic">&ldquo;Umuntu ngumuntu ngabantu.&rdquo;</p>
          <p className="text-green-400 text-xs mt-1">
            {lang === 'fr' ? 'Je suis parce que nous sommes.' : 'I am because we are.'}
          </p>
        </div>

        {/* Lesson list */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">
            {lang === 'fr' ? 'Choisir une leçon' : 'Choose a lesson'}
          </h2>
          <div className="flex flex-col gap-3">
            {lessons.map((lesson) => {
              const isActive = lesson.id === currentLesson?.id
              return (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setCurrentLesson(lesson)
                    setPhase('flashcard')
                    setWordIndex(0)
                    setCorrectCount(0)
                    setXpEarned(0)
                    // Reload words for this lesson if different
                    if (lesson.id !== currentLesson?.id) {
                      loadLesson(lesson.slug)
                    } else {
                      setPhase('flashcard')
                    }
                  }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                    isActive ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-green-300'
                  }`}
                >
                  <span className="text-3xl flex-shrink-0">{lesson.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {lang === 'fr' ? lesson.title_fr : lesson.title_en}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        lesson.level === 1 ? 'bg-green-100 text-green-700'
                        : lesson.level === 2 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {lang === 'fr'
                          ? lesson.level === 1 ? 'Débutant' : lesson.level === 2 ? 'Intermédiaire' : 'Avancé'
                          : lesson.level === 1 ? 'Beginner' : lesson.level === 2 ? 'Intermediate' : 'Advanced'}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{lesson.theme}</span>
                    </div>
                  </div>
                  <span className="text-green-600 text-lg flex-shrink-0">→</span>
                </button>
              )
            })}
          </div>
        </div>

        {!isLoggedIn && (
          <p className="text-center text-xs text-gray-400">
            {lang === 'fr'
              ? '💡 Connecte-toi pour sauvegarder ta progression et tes séries.'
              : '💡 Log in to save your progress and streaks.'}
          </p>
        )}
      </div>
    )
  }

  // ── COMPLETE ──────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="max-w-sm mx-auto px-4 py-8">
        <LessonComplete
          score={score}
          xpEarned={xpEarned}
          wordsCount={words.length}
          lessonTitle={currentLesson ? (lang === 'fr' ? currentLesson.title_fr : currentLesson.title_en) : ''}
          nextSlug={nextLesson?.slug ?? null}
          locale={lang}
        />
      </div>
    )
  }

  // ── LESSON HEADER (shared for flashcard + quiz) ───────────────
  const currentWord = words[wordIndex]
  if (!currentWord) return null

  return (
    <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-6">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPhase('lobby')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕
        </button>
        <div className="flex-1 mx-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <StreakBar streak={streak.current_streak} xp={streak.xp_total} />
      </div>

      {/* Phase label */}
      <div className="text-center">
        <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
          {phase === 'flashcard'
            ? (lang === 'fr' ? `Découverte — mot ${wordIndex + 1}/${words.length}` : `Discovery — word ${wordIndex + 1}/${words.length}`)
            : (lang === 'fr' ? `Quiz — question ${wordIndex + 1}/${words.length}` : `Quiz — question ${wordIndex + 1}/${words.length}`)}
        </span>
      </div>

      {/* Exercise */}
      {phase === 'flashcard' && (
        <FlashCard
          swahili={currentWord.swahili}
          french={currentWord.french}
          english={currentWord.english}
          exampleSw={currentWord.example_sw}
          exampleFr={currentWord.example_fr}
          onNext={handleFlashcard}
          locale={lang}
        />
      )}

      {phase === 'quiz' && (
        <MultipleChoice
          swahili={currentWord.swahili}
          correct={lang === 'fr' ? currentWord.french : currentWord.english}
          options={buildOptions(currentWord, allWords, lang)}
          onNext={handleQuiz}
          locale={lang}
        />
      )}
    </div>
  )
}
