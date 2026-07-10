'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState, useRef } from 'react'

interface Props {
  defaultValue?: string
}

export default function MarketplaceSearchBar({ defaultValue = '' }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function navigate(q: string) {
    startTransition(() => {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      router.push(`/marketplace${params.size ? `?${params}` : ''}`)
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setValue(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(q), 400)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    navigate(value)
  }

  function handleClear() {
    setValue('')
    navigate('')
  }

  return (
    <form onSubmit={handleSubmit} className="relative mt-3">
      <div className="relative flex items-center">
        <span className="absolute left-3 text-brand-200 text-base pointer-events-none select-none">
          {isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </span>
        <input
          type="search"
          value={value}
          onChange={handleChange}
          placeholder="Rechercher un produit ou marchand…"
          className="w-full bg-white/15 backdrop-blur-sm text-white placeholder-brand-200 border border-white/20 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20 transition-all"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 text-brand-200 hover:text-white text-lg leading-none"
            aria-label="Effacer"
          >
            ×
          </button>
        )}
      </div>
    </form>
  )
}
