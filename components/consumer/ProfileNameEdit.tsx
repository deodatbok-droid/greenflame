'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ProfileNameEdit({ initialName }: { initialName: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [input, setInput] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = input.trim()
    if (!trimmed || trimmed === name) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: trimmed }),
      })
      if (res.ok) {
        setName(trimmed)
        setEditing(false)
        toast.success('Nom mis à jour')
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Erreur')
      }
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setEditing(false); setInput(name) }
          }}
          className="bg-white/20 text-white placeholder-white/50 text-sm font-bold rounded-lg px-2 py-1 outline-none border border-white/40 focus:border-white min-w-0 flex-1"
          maxLength={50}
        />
        <button onClick={save} disabled={saving} className="text-white/80 hover:text-white text-xs font-bold shrink-0 disabled:opacity-50">
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => { setEditing(false); setInput(name) }} className="text-white/40 hover:text-white/80 text-xs shrink-0">✕</button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setInput(name); setEditing(true) }}
      className="flex items-center gap-1.5 group text-left w-full min-w-0"
    >
      <p className="text-white font-bold text-base leading-tight truncate">{name}</p>
      <span className="text-white/30 group-hover:text-white/70 text-xs transition-colors shrink-0" title="Modifier le nom">✏️</span>
    </button>
  )
}
