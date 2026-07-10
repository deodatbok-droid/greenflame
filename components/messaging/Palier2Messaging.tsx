'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * components/messaging/Palier2Messaging.tsx
 *
 * Palier 2 — recherche exacte + invitation à discuter avec n'importe quel
 * membre de la plateforme (achat ET KYC requis). Ne s'affiche que pour les
 * utilisateurs déjà éligibles ; le contrôle d'éligibilité côté UI n'est
 * qu'un confort d'affichage — l'API impose le verrou réel (RLS + checks
 * serveur), donc même un appel direct sans passer par ce composant resterait
 * bloqué pour un utilisateur non éligible.
 */

type SearchResult = { id: string; full_name: string; avatar_url: string | null }
type Invitation = {
  id: string
  direction: 'envoyee' | 'recue'
  status: 'en_attente' | 'acceptee' | 'refusee'
  conversationId: string | null
  createdAt: string
  otherUser: { id: string; full_name: string; avatar_url: string | null }
}

export default function Palier2Messaging() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [responding, setResponding] = useState<string | null>(null)

  const loadInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/invitations')
      const data = await res.json()
      if (res.ok) setInvitations(data.invitations ?? [])
    } catch {
      // silencieux — non bloquant pour la recherche
    }
  }, [])

  useEffect(() => {
    loadInvitations()
  }, [loadInvitations])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (res.ok) setResults(data.results ?? [])
        else {
          setResults([])
          if (res.status === 403) toast.error(data.error ?? 'Accès refusé')
        }
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [query])

  async function invite(toUserId: string) {
    if (inviting) return
    setInviting(toUserId)
    try {
      const res = await fetch('/api/messages/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success('Invitation envoyée')
      setQuery('')
      setResults([])
      loadInvitations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setInviting(null)
    }
  }

  async function respond(invitationId: string, action: 'accept' | 'refuse') {
    if (responding) return
    setResponding(invitationId)
    try {
      const res = await fetch(`/api/messages/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      if (action === 'accept' && data.conversationId) {
        router.push(`/messages/${data.conversationId}`)
        return
      }
      loadInvitations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setResponding(null)
    }
  }

  const pendingReceived = invitations.filter(i => i.direction === 'recue' && i.status === 'en_attente')
  const others = invitations.filter(i => !(i.direction === 'recue' && i.status === 'en_attente'))

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="font-semibold text-sm text-gray-800 mb-2">🔎 Trouver un membre</p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom complet, téléphone ou code d'invitation"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {searching && <p className="text-xs text-gray-400 mt-2">Recherche…</p>}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">Aucun membre trouvé pour cette correspondance exacte.</p>
        )}
        {results.length > 0 && (
          <div className="mt-3 space-y-2">
            {results.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                    {r.full_name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <p className="text-sm text-gray-800 truncate">{r.full_name}</p>
                </div>
                <button
                  onClick={() => invite(r.id)}
                  disabled={inviting === r.id}
                  className="text-xs font-semibold bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {inviting === r.id ? '…' : 'Inviter'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingReceived.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="font-semibold text-sm text-gray-800 mb-2">📩 Invitations reçues</p>
          <div className="space-y-2">
            {pendingReceived.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-800 truncate">{inv.otherUser.full_name}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => respond(inv.id, 'accept')}
                    disabled={responding === inv.id}
                    className="text-xs font-semibold bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => respond(inv.id, 'refuse')}
                    disabled={responding === inv.id}
                    className="text-xs font-semibold bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="font-semibold text-sm text-gray-800 mb-2">Historique des invitations</p>
          <div className="space-y-2">
            {others.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700 truncate">
                  {inv.direction === 'envoyee' ? `→ ${inv.otherUser.full_name}` : `${inv.otherUser.full_name} →`}
                </p>
                {inv.status === 'acceptee' && inv.conversationId ? (
                  <button
                    onClick={() => router.push(`/messages/${inv.conversationId}`)}
                    className="text-xs font-semibold text-brand-600 flex-shrink-0"
                  >
                    Discuter
                  </button>
                ) : (
                  <span className={`text-xs flex-shrink-0 ${inv.status === 'refusee' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {inv.status === 'refusee' ? 'Refusée' : 'En attente'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
