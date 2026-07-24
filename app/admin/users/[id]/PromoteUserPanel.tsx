'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const ALL_ROLES = ['consumer', 'merchant', 'field_agent', 'kingmaker', 'platform_upline', 'admin']

export default function PromoteUserPanel({
  userId,
  currentRoles,
}: {
  userId: string
  currentRoles: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<string[]>(currentRoles)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleRole(role: string) {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  async function save() {
    setLoading(true)
    const res = await fetch('/api/admin/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, roles, email: email || undefined }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Erreur'); return }
    toast.success('Roles mis a jour')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors w-full text-center"
      >
        Gerer les roles
      </button>
    )
  }

  return (
    <div className="mt-3 border border-gray-600 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Roles</p>
      <div className="flex flex-wrap gap-2">
        {ALL_ROLES.map(role => (
          <button
            key={role}
            onClick={() => toggleRole(role)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              roles.includes(role)
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            {role}
          </button>
        ))}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">Email (optionnel)</p>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="utilisateur@exemple.com"
          className="w-full bg-gray-700 text-white text-xs px-3 py-2 rounded-lg border border-gray-600 focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={loading} className="flex-1 bg-brand-600 text-white text-xs py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
        <button onClick={() => { setOpen(false); setRoles(currentRoles) }} className="px-3 bg-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:bg-gray-600">
          Annuler
        </button>
      </div>
    </div>
  )
}
