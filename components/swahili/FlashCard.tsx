'use client'

import { useState } from 'react'
import { useSpeech } from '@/hooks/useSpeech'

interface Props {
  swahili: string
  french: string
  english: string
  exampleSw?: string | null
  exampleFr?: string | null
  onNext: (correct: boolean) => void
  locale?: 'fr' | 'en'
}

export default function FlashCard({ swahili, french, english, exampleSw, exampleFr, onNext, locale = 'fr' }: Props) {
  const [flipped, setFlipped] = useState(false)
  const { supported, speaking, speak } = useSpeech()
  const translation = locale === 'fr' ? french : english

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      {/* Card */}
      <div className="w-full select-none">
        <div className={`relative w-full rounded-3xl shadow-lg transition-all duration-500 ${flipped ? 'min-h-52' : 'min-h-44'}`}>

          {/* Front — mot swahili */}
          {!flipped && (
            <div
              className="absolute inset-0 bg-gradient-to-br from-green-800 to-green-950 rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer"
              onClick={() => setFlipped(true)}
            >
              <p className="text-4xl font-bold text-white tracking-wide mb-2">{swahili}</p>

              {supported && (
                <button
                  onClick={e => { e.stopPropagation(); speak(swahili) }}
                  className={`mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    speaking
                      ? 'bg-green-400 text-green-900 animate-pulse'
                      : 'bg-white/20 text-green-100 hover:bg-white/30'
                  }`}
                >
                  {speaking ? '🔊 …' : '🔊 Écouter'}
                </button>
              )}

              <p className="text-green-300 text-sm mt-3">Appuie pour révéler</p>
            </div>
          )}

          {/* Back — traduction + exemple */}
          {flipped && (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex flex-col items-center justify-center p-8 text-center gap-2">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-white">{translation}</p>
                {supported && (
                  <button
                    onClick={() => speak(swahili)}
                    title="Réentendre le mot swahili"
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                      speaking ? 'bg-white/40 animate-pulse' : 'bg-white/20 hover:bg-white/35'
                    }`}
                  >
                    🔊
                  </button>
                )}
              </div>

              {exampleSw && (
                <div className="mt-2 bg-white/20 rounded-2xl px-4 py-2 text-center w-full">
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-white/90 text-sm italic">&ldquo;{exampleSw}&rdquo;</p>
                    {supported && (
                      <button
                        onClick={() => speak(exampleSw)}
                        title="Écouter l'exemple"
                        className="flex-shrink-0 text-white/70 hover:text-white text-sm"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                  {exampleFr && <p className="text-white/70 text-xs mt-1">{exampleFr}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {flipped ? (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => onNext(false)}
            className="flex-1 py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors"
          >
            😅 À revoir
          </button>
          <button
            onClick={() => onNext(true)}
            className="flex-1 py-3 rounded-2xl bg-green-700 text-white font-semibold text-sm hover:bg-green-800 transition-colors"
          >
            ✅ Je savais !
          </button>
        </div>
      ) : (
        <button
          onClick={() => setFlipped(true)}
          className="w-full py-3 rounded-2xl bg-green-700 text-white font-semibold text-sm hover:bg-green-800 transition-colors"
        >
          Révéler la traduction
        </button>
      )}
    </div>
  )
}
