'use client'

import { useState } from 'react'
import { useSpeech } from '@/hooks/useSpeech'

interface Props {
  swahili: string
  correct: string
  options: string[]
  onNext: (correct: boolean) => void
  locale?: 'fr' | 'en'
}

export default function MultipleChoice({ swahili, correct, options, onNext, locale = 'fr' }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const { supported, speaking, speak } = useSpeech()

  const choose = (opt: string) => {
    if (selected) return
    setSelected(opt)
    setTimeout(() => onNext(opt === correct), 900)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      {/* Question */}
      <div className="w-full bg-gradient-to-br from-green-800 to-green-950 rounded-3xl p-8 text-center shadow-lg">
        <p className="text-xs text-green-300 uppercase tracking-widest mb-3">
          {locale === 'fr' ? 'Que signifie...' : 'What does ... mean?'}
        </p>
        <p className="text-4xl font-bold text-white tracking-wide">{swahili}</p>

        {supported && (
          <button
            onClick={() => speak(swahili)}
            className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              speaking
                ? 'bg-green-400 text-green-900 animate-pulse'
                : 'bg-white/20 text-green-100 hover:bg-white/30'
            }`}
          >
            {speaking ? '🔊 …' : '🔊 Écouter'}
          </button>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((opt) => {
          const isCorrect = opt === correct
          const isSelected = opt === selected
          let style = 'border-2 border-gray-200 bg-white text-gray-800 hover:border-green-400 hover:bg-green-50'
          if (selected) {
            if (isCorrect)       style = 'border-2 border-green-500 bg-green-50 text-green-800'
            else if (isSelected) style = 'border-2 border-red-400 bg-red-50 text-red-700'
            else                 style = 'border-2 border-gray-100 bg-gray-50 text-gray-400'
          }
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              className={`py-4 px-3 rounded-2xl font-semibold text-sm transition-all text-center ${style}`}
            >
              {isSelected && selected && (isCorrect ? '✅ ' : '❌ ')}{opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
