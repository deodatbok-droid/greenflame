'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  score: number          // 0-100
  xpEarned: number
  wordsCount: number
  lessonTitle: string
  nextSlug?: string | null
  locale?: 'fr' | 'en'
}

export default function LessonComplete({ score, xpEarned, wordsCount, lessonTitle, nextSlug, locale = 'fr' }: Props) {
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 100) }, [])

  const stars = score >= 90 ? 3 : score >= 60 ? 2 : 1
  const message = locale === 'fr'
    ? score >= 90 ? 'Parfait ! Tu maîtrises ces mots 🔥'
    : score >= 60 ? 'Bien joué ! Continue comme ça 💪'
    : 'Pas mal ! Reviens pratiquer demain 🌱'
    : score >= 90 ? 'Perfect! You mastered these words 🔥'
    : score >= 60 ? 'Well done! Keep it up 💪'
    : 'Not bad! Come back to practice tomorrow 🌱'

  return (
    <div className={`flex flex-col items-center gap-6 w-full max-w-sm mx-auto text-center transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Stars */}
      <div className="flex gap-2 text-5xl">
        {[1,2,3].map(s => (
          <span key={s} className={`transition-all duration-300 ${s <= stars ? 'scale-110' : 'opacity-30'}`}>
            ⭐
          </span>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {locale === 'fr' ? 'Leçon terminée !' : 'Lesson complete!'}
        </h2>
        <p className="text-gray-500 text-sm">{lessonTitle}</p>
      </div>

      {/* Stats */}
      <div className="w-full grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-2xl font-bold text-green-700">{score}%</p>
          <p className="text-xs text-green-600 mt-1">{locale === 'fr' ? 'Score' : 'Score'}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-2xl font-bold text-amber-600">+{xpEarned}</p>
          <p className="text-xs text-amber-600 mt-1">XP</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-2xl font-bold text-emerald-700">{wordsCount}</p>
          <p className="text-xs text-emerald-600 mt-1">{locale === 'fr' ? 'Mots' : 'Words'}</p>
        </div>
      </div>

      <p className="text-gray-600 text-sm">{message}</p>

      {/* Ubuntu moment */}
      <div className="w-full bg-green-950 rounded-2xl px-6 py-4 text-center">
        <p className="text-amber-300 text-xs italic">&ldquo;Umuntu ngumuntu ngabantu.&rdquo;</p>
        <p className="text-green-400 text-xs mt-1">
          {locale === 'fr' ? 'Chaque mot appris renforce l\'Afrique.' : 'Every word learned strengthens Africa.'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        {nextSlug && (
          <Link
            href={`/swahili?lesson=${nextSlug}`}
            className="w-full py-3 rounded-2xl bg-green-700 text-white font-semibold text-sm hover:bg-green-800 transition-colors text-center"
          >
            {locale === 'fr' ? 'Leçon suivante →' : 'Next lesson →'}
          </Link>
        )}
        <Link
          href="/swahili"
          className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors text-center"
        >
          {locale === 'fr' ? 'Toutes les leçons' : 'All lessons'}
        </Link>
      </div>
    </div>
  )
}
