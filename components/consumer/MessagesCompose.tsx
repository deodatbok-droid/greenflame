'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

interface SearchResult {
  id: string
  full_name: string
  avatar_url: string | null
}

export default function MessagesCompose() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [gateError, setGateError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setGateError(null); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      setGateError(null)
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) { setGateError(data.error ?? 'Erreur'); setResults([]) }
        else setResults(data.results ?? [])
      } catch { setGateError('Erreur réseau') }
      finally { setSearching(false) }
    }, 400)
  }, [query])

  async function invite(userId: string, name: string) {
    const res = await fetch('/api/messages/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: userId }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
    setInvited(s => new Set([...s, userId]))
    toast.success(`Invitation envoyée à ${name}`)
  }

  function close() { setOpen(false); setQuery(''); setResults([]); setGateError(null) }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Nouvelle conversation"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-600 text-white shadow-sm active:scale-95 transition-transform"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Nouvelle conversation</h2>
              <button onClick={close} aria-label="Fermer" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl leading-none transition-colors">×</button>
            </div>

            <div className="px-4 py-3">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Nom complet, numéro ou code de parrainage…"
                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brand-400 bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1.5 px-0.5">
                Saisie exacte uniquement — la recherche partielle est désactivée pour la confidentialité.
              </p>
            </div>

            <div className="px-4 pb-5 min-h-[5rem]">
              {searching && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!searching && gateError && (
                <p className="text-sm text-center text-amber-600 bg-amber-50 rounded-xl p-3">{gateError}</p>
              )}
              {!searching && !gateError && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-4">Aucun membre trouvé</p>
              )}
              {!searching && results.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 text-base font-semibold text-brand-700">
                    {r.full_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="flex-1 text-sm font-medium text-gray-900 min-w-0 truncate">{r.full_name}</p>
                  {invited.has(r.id) ? (
                    <span className="text-xs text-green-600 font-semibold flex-shrink-0">Invité ✓</span>
                  ) : (
                    <button
                      onClick={() => invite(r.id, r.full_name)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                    >
                      Inviter
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </>
  )
}
