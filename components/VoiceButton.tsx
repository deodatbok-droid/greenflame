'use client'

import { useVoice } from '@/lib/hooks/useVoice'

export default function VoiceButton({
  onResult,
  className = '',
  lang = 'fr-FR',
}: {
  onResult: (text: string) => void
  className?: string
  lang?: string
}) {
  const { listening, supported, start, stop } = useVoice(onResult, lang)

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`relative flex items-center justify-center rounded-full transition-all ${
        listening
          ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-110'
          : 'bg-brand-100 text-brand-600 hover:bg-brand-200'
      } ${className}`}
      title={listening ? 'Arreter l\'ecoute' : 'Parler'}
    >
      {listening && (
        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
      )}
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
      </svg>
    </button>
  )
}
