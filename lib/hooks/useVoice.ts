'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

export function useVoice(onResult: (transcript: string) => void, lang = 'fr-FR') {
  const [listening, setListening] = useState(false)
  // Ne pas utiliser useState initializer : window est undefined côté SSR Next.js,
  // ce qui bloque définitivement supported=false même après hydration côté client.
  const [supported, setSupported] = useState(false)

  // Détection côté client uniquement (après hydration)
  useEffect(() => {
    setSupported(
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    )
  }, [])
  const recRef = useRef<AnySpeechRecognition>(null)

  const start = useCallback(() => {
    if (!supported) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) onResult(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [supported, lang, onResult])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

export function speak(text: string, lang = 'fr-FR') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang
  utt.rate = 1.0
  window.speechSynthesis.speak(utt)
}
