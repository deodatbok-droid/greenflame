'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  full_name: string
  avatar_url: string | null
}

export default function NewConversationButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'search'>('menu')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when search view opens
  useEffect(() => {
    if (view === 'search') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [view])

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function reset() {
    setOpen(false)
    setView('menu')
    setQuery('')
    setResults([])
    setError(null)
    setLoading(false)
  }

  async function handleCercle() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/messages/conversations/cercle-upline', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      reset()
      router.push(`/messages/${data.conversationId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
      setLoading(false)
    }
  }

  function handleSearchInput(val: string) {
    setQuery(val)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/messages/search?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erreur')
        setResults(data.results ?? [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  const [invited, setInvited] = useState<string | null>(null)  // userId of person we just invited

  async function sendInvitation(targetId: string) {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/messages/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: targetId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setInvited(targetId)
      setLoading(false)
      // Close after short delay
      setTimeout(() => reset(), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Bouton "+" */}
      <button
        onClick={() => { setOpen(true); setView('menu') }}
        className="w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center text-xl font-bold shadow-sm transition-colors active:scale-95"
        title="Nouvelle conversation"
      >
        +
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={e => { if (e.target === e.currentTarget) reset() }}
        >
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              {view === 'search' ? (
                <button
                  onClick={() => { setView('menu'); setQuery(''); setResults([]); setError(null) }}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  ← Retour
                </button>
              ) : (
                <h2 className="font-bold text-gray-900 text-base">Nouvelle conversation</h2>
              )}
              <button onClick={reset} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            {/* ── Vue menu ── */}
            {view === 'menu' && (
              <div className="p-4 space-y-3">
                {/* Option 1 : Cercle communautaire */}
                <button
                  onClick={handleCercle}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left disabled:opacity-60"
                >
                  <span className="text-2xl">👑</span>
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Mon cercle communautaire</p>
                    <p className="text-xs text-amber-700 mt-0.5">Discuter avec votre upline et vos filleuls directs</p>
                  </div>
                </button>

                {/* Option 2 : Chercher un contact */}
                <button
                  onClick={() => setView('search')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-2xl">🌐</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Chercher un contact</p>
                    <p className="text-xs text-gray-500 mt-0.5">Par téléphone, code de parrainage ou nom</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Nécessite KYC + premier achat</p>
                  </div>
                </button>

                {error && (
                  <p className="text-xs text-red-500 text-center px-2">{error}</p>
                )}
              </div>
            )}

            {/* ── Vue recherche ── */}
            {view === 'search' && (
              <div className="p-4 space-y-3">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => handleSearchInput(e.target.value)}
                    placeholder="Téléphone, code de parrainage, nom exact…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 pr-10"
                  />
                  {loading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">⏳</span>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {/* Succès invitation */}
                {invited && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-green-800">✅ Invitation envoyée !</p>
                    <p className="text-xs text-green-600 mt-0.5">La conversation s&apos;ouvrira dès que le contact accepte.</p>
                  </div>
                )}

                {/* Résultats */}
                {!invited && results.length > 0 && (
                  <div className="space-y-1.5">
                    {results.map(r => (
                      <button
                        key={r.id}
                        onClick={() => sendInvitation(r.id)}
                        disabled={loading}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-brand-50 hover:border-brand-300 transition-all text-left disabled:opacity-60"
                      >
                        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                          {r.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.full_name}</p>
                          <p className="text-[10px] text-gray-400">Appuyer pour envoyer une invitation</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && query.length >= 2 && results.length === 0 && !error && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Aucun résultat pour « {query} »</p>
                    <p className="text-xs text-gray-400 mt-1">Essayez le numéro exact ou le code de parrainage</p>
                  </div>
                )}

                {query.length < 2 && (
                  <p className="text-xs text-gray-400 text-center">Saisissez au moins 2 caractères</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
