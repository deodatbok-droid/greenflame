'use client'

import { useState, useCallback } from 'react'
import { useVoice, speak } from '@/lib/hooks/useVoice'

export default function VoiceSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('')

  const handleResult = useCallback((transcript: string) => {
    setQuery(transcript)
    onSearch(transcript)
    speak(`Recherche : ${transcript}`)
  }, [onSearch])

  const { listening, supported, start, stop } = useVoice(handleResult)

  if (!supported) return null

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-2 shadow-sm">
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onSearch(e.target.value) }}
        placeholder="Rechercher… ou parler 🎤"
        className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
      />
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          listening ? 'bg-red-500 text-white' : 'bg-brand-100 text-brand-600 hover:bg-brand-200'
        }`}
      >
        {listening && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
        </svg>
      </button>
    </div>
  )
}
