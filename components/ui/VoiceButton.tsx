'use client'

import { useState, useRef, useCallback } from 'react'

export type VoiceAction = {
  action: 'budget_entry' | 'navigate' | 'unknown'
  data: Record<string, unknown>
  reply: string
  confidence: number
}

type Phase = 'idle' | 'listening' | 'processing' | 'speaking'

type Props = {
  context?: Record<string, unknown>
  onAction?: (action: VoiceAction) => void
  label?: string
  className?: string
}

export function VoiceButton({ context, onAction, label = 'Appuie pour parler', className = '' }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [displayText, setDisplayText] = useState('')
  const transcriptRef = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPhase('idle')
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'fr-FR'
    u.rate = 1.05
    u.onend = () => setPhase('idle')
    u.onerror = () => setPhase('idle')
    setPhase('speaking')
    window.speechSynthesis.speak(u)
  }, [])

  const sendToApi = useCallback(async (text: string) => {
    setPhase('processing')
    try {
      const res = await fetch('/api/voice/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, context }),
      })
      if (!res.ok) throw new Error('API error')
      const action = await res.json() as VoiceAction
      setDisplayText(action.reply)
      speak(action.reply)
      onAction?.(action)
    } catch {
      setPhase('idle')
    }
  }, [context, onAction, speak])

  function startListening() {
    if (phase !== 'idle') return
    if (typeof window === 'undefined') return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      setDisplayText('Non disponible — utilise Chrome sur Android.')
      return
    }

    transcriptRef.current = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog: any = new SR()
    recog.lang = 'fr-FR'
    recog.continuous = false
    recog.interimResults = true

    recog.onstart = () => {
      setPhase('listening')
      setDisplayText('')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from<any>(e.results).map((r: any) => r[0].transcript).join('')
      transcriptRef.current = t
      setDisplayText(t)
    }
    recog.onerror = () => setPhase('idle')
    recog.onend = () => {
      const t = transcriptRef.current.trim()
      if (t) sendToApi(t)
      else setPhase('idle')
    }

    recogRef.current = recog
    recog.start()
  }

  function stopListening() {
    recogRef.current?.stop()
  }

  const btnStyle: Record<Phase, string> = {
    idle:       'bg-green-500 active:bg-green-600 shadow-green-200',
    listening:  'bg-red-500 shadow-red-200 animate-pulse',
    processing: 'bg-orange-400 shadow-orange-200 cursor-wait',
    speaking:   'bg-blue-500 shadow-blue-200',
  }

  const btnIcon: Record<Phase, string> = {
    idle: '🎤', listening: '⏹', processing: '⏳', speaking: '🔊',
  }

  const hint: Record<Phase, string> = {
    idle:       label,
    listening:  'Appuie pour arrêter',
    processing: 'Traitement en cours…',
    speaking:   'Lecture de la réponse…',
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <button
        onClick={phase === 'idle' ? startListening : phase === 'listening' ? stopListening : undefined}
        disabled={phase === 'processing'}
        className={`w-16 h-16 rounded-full text-white text-2xl flex items-center justify-center shadow-lg transition-all select-none disabled:opacity-60 ${btnStyle[phase]}`}
        aria-label={hint[phase]}
      >
        {btnIcon[phase]}
      </button>
      <p className="text-xs text-gray-500 text-center font-medium">{hint[phase]}</p>
      {displayText && (
        <p className={`text-xs text-center max-w-[240px] leading-relaxed ${phase === 'idle' ? 'text-green-700 font-semibold' : 'text-gray-400 italic'}`}>
          {displayText}
        </p>
      )}
    </div>
  )
}
