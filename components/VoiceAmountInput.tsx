'use client'

/**
 * VoiceAmountInput — Champ montant avec bouton vocal intégré.
 * Écoute, parse en français, remplit le champ et donne un retour TTS.
 *
 * Usage:
 *   <VoiceAmountInput value={amount} onChange={setAmount} placeholder="0" />
 */

import { useCallback } from 'react'
import { useVoice, speak } from '@/lib/hooks/useVoice'
import { extractAmount } from '@/lib/utils/voiceParser'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  suffix?: string       // ex: "FCFA"
  autoFocus?: boolean
}

export default function VoiceAmountInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  suffix = 'FCFA',
  autoFocus = false,
}: Props) {
  const handleResult = useCallback((transcript: string) => {
    const amount = extractAmount(transcript)
    if (amount && amount >= 50) {
      onChange(String(amount))
      speak(`Montant : ${amount.toLocaleString('fr-FR')} ${suffix}`)
    } else {
      speak('Montant non reconnu. Dites par exemple : cinq mille francs.')
    }
  }, [onChange, suffix])

  const { listening, supported, start, stop } = useVoice(handleResult)

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className={`input text-right text-2xl font-bold pr-20 ${className}`}
        autoFocus={autoFocus}
        inputMode="numeric"
      />
      <span className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm pointer-events-none">
        {suffix}
      </span>
      {supported && (
        <button
          type="button"
          onClick={listening ? stop : start}
          title={listening ? 'Arrêter' : 'Dicter le montant'}
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            listening
              ? 'bg-red-500 text-white shadow-md shadow-red-200'
              : 'bg-brand-100 text-brand-600 hover:bg-brand-200'
          }`}
        >
          {listening && (
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40 pointer-events-none" />
          )}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </button>
      )}
    </div>
  )
}
