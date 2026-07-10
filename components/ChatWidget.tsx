'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/components/providers/LocaleProvider'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// ── Renderer markdown léger (sans dépendance externe) ──────────────────────
function inlineFormat(text: string, baseKey: string): React.ReactNode {
  const parts: (string | React.ReactElement)[] = []
  const regex = /\*\*(.+?)\*\*|\*([^*]+)\*|`([^`]+)`/g
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    if (m[1] !== undefined) {
      parts.push(<strong key={`${baseKey}-${m.index}-b`} className="font-semibold text-gray-900">{m[1]}</strong>)
    } else if (m[2] !== undefined) {
      parts.push(<em key={`${baseKey}-${m.index}-i`}>{m[2]}</em>)
    } else {
      parts.push(<code key={`${baseKey}-${m.index}-c`} className="bg-gray-100 text-brand-700 px-1 py-0.5 rounded text-[11px] font-mono">{m[3]}</code>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  const bullets: string[] = []

  function flushBullets(key: string) {
    if (!bullets.length) return
    result.push(
      <ul key={key} className="my-1 space-y-0.5 pl-0">
        {bullets.map((item, i) => (
          <li key={i} className="flex gap-1.5 items-start">
            <span className="text-brand-500 text-xs mt-1 flex-shrink-0">•</span>
            <span className="text-sm leading-relaxed">{inlineFormat(item, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    )
    bullets.length = 0
  }

  lines.forEach((line, idx) => {
    const k = `l${idx}`
    if (/^#{1,3} /.test(line)) {
      flushBullets(`b${idx}`)
      const text = line.replace(/^#{1,3} /, '')
      result.push(<p key={k} className="font-semibold text-gray-800 text-sm mt-2.5 mb-0.5 first:mt-0">{inlineFormat(text, k)}</p>)
    } else if (line.trim() === '---') {
      flushBullets(`b${idx}`)
      result.push(<hr key={k} className="border-gray-200 my-2" />)
    } else if (/^[*-] /.test(line)) {
      bullets.push(line.slice(2))
    } else if (line.trim() === '') {
      flushBullets(`b${idx}`)
    } else {
      flushBullets(`b${idx}`)
      result.push(<p key={k} className="text-sm text-gray-700 leading-relaxed">{inlineFormat(line, k)}</p>)
    }
  })
  flushBullets('bend')

  return <div className="space-y-0.5">{result}</div>
}

const MAX_HISTORY_SENT = 10

export default function ChatWidget() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = messages.slice(-MAX_HISTORY_SENT)
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setError(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, locale }),
      })
      if (!res.ok) throw new Error('api')
      const data = await res.json() as { reply?: string; error?: string }
      if (!data.reply) throw new Error('empty')
      setMessages(m => [...m, { role: 'assistant', content: data.reply! }])
    } catch {
      setError(true)
      setMessages(m => [
        ...m,
        { role: 'assistant', content: t('chat.errorFallback') },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-44 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-brand-600 shadow-black/20 active:scale-95 transition-all"
        aria-label={t('chat.ariaOpen')}
      >
        {open ? (
          <span className="text-white text-xl leading-none">×</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.6 1.32 4.93 3.4 6.55-.1.93-.42 2.27-1.27 3.7a.5.5 0 0 0 .57.73c1.96-.6 3.46-1.46 4.4-2.1.9.24 1.87.37 2.9.37 5.52 0 10-3.94 10-8.8C22 5.94 17.52 2 12 2z"/>
          </svg>
        )}
      </button>

      {/* Panneau chat */}
      {open && (
        <div className="fixed bottom-60 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] h-[28rem] max-h-[65vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">

          <div className="px-4 py-3 bg-brand-600 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">{t('chat.title')}</span>
              {loading && (
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">…</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-xs text-gray-400 mt-6 px-4">
                {t('chat.emptyHint')}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-brand-600 text-white text-sm'
                      : 'bg-white border border-gray-100'
                  }`}
                >
                  {m.role === 'user' ? m.content : <MarkdownMessage content={m.content} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-400 border border-gray-100 rounded-xl px-3 py-2 text-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              disabled={loading}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 focus:outline-none focus:border-brand-400 disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
              aria-label={t('chat.ariaSend')}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
              </svg>
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-red-400 text-center pb-1.5">{t('chat.errorHint')}</p>
          )}
        </div>
      )}
    </>
  )
}
