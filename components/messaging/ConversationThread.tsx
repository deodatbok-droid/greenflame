'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  message_type?: 'user' | 'system'
  content: string
  created_at: string
  sender?: { full_name: string } | null
}

interface Props {
  conversationId: string
  currentUserId: string
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}
function firstName(name: string): string {
  return name.split(' ')[0]
}

export default function ConversationThread({ conversationId, currentUserId }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  // Récupère les messages avec sender.full_name — utilisé aussi comme refresh
  // silencieux après un événement Realtime (pas de setLoading pour éviter le flash).
  const fetchMessages = useCallback(async (): Promise<Message[]> => {
    const res = await fetch(`/api/messages/${conversationId}`)
    if (!res.ok) return []
    const data = await res.json() as { messages: Message[] }
    data.messages.forEach(m => seenIds.current.add(m.id))
    return data.messages
  }, [conversationId])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const msgs = await fetchMessages()
    setMessages(msgs)
    setLoading(false)
  }, [fetchMessages])

  useEffect(() => { loadInitial() }, [loadInitial])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as Message
          if (seenIds.current.has(m.id)) return
          seenIds.current.add(m.id)

          if (m.sender_id === currentUserId) {
            // Message propre — déjà ajouté de façon optimiste via POST,
            // on s'assure juste qu'il y est (idempotent, pas de sender affiché).
            setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
          } else {
            // Message d'autrui — rafraîchissement silencieux pour obtenir
            // sender.full_name que postgres_changes ne renvoie pas.
            const msgs = await fetchMessages()
            setMessages(msgs)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, conversationId, currentUserId, fetchMessages])

  async function sendMessage() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const data = await res.json() as { message: Message }
        if (!seenIds.current.has(data.message.id)) {
          seenIds.current.add(data.message.id)
          setMessages(prev => [...prev, data.message])
        }
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-center text-xs text-gray-400 mt-6">Chargement…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 mt-6 px-4">
            Aucun message pour l&rsquo;instant — écris le premier.
          </p>
        ) : (
          messages.map(m => {
            if (m.message_type === 'system') {
              return (
                <div key={m.id} className="flex justify-center my-1">
                  <span className="text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1 max-w-[90%]">
                    {m.content}
                  </span>
                </div>
              )
            }

            const isMine = m.sender_id === currentUserId
            const senderName = m.sender?.full_name ?? ''

            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar initiales — uniquement pour les messages d'autrui */}
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0 mb-0.5">
                    {initials(senderName)}
                  </div>
                )}

                <div className={`flex flex-col gap-0.5 max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Prénom — uniquement pour les messages d'autrui */}
                  {!isMine && senderName && (
                    <span className="text-[10px] text-gray-400 ml-1 leading-none">
                      {firstName(senderName)}
                    </span>
                  )}
                  <div
                    className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                      isMine
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-700 border border-gray-100 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="p-2 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 bg-white">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écris ton message…"
          disabled={sending}
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 focus:outline-none focus:border-brand-400 disabled:opacity-60"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
          aria-label="Envoyer"
        >
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
