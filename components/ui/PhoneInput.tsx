'use client'

import { useState, useRef, useEffect } from 'react'

interface Country {
  code: string
  dial: string
  flag: string
  name: string
}

const ECOWAS: Country[] = [
  { code: 'BJ', dial: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'TG', dial: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: 'BF', dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'GH', dial: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigéria' },
  { code: 'ML', dial: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: 'NE', dial: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: 'GN', dial: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', name: 'R.D. Congo' },
  { code: 'MR', dial: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: 'GM', dial: '+220', flag: '🇬🇲', name: 'Gambie' },
  { code: 'GW', dial: '+245', flag: '🇬🇼', name: 'Guinée-Bissau' },
  { code: 'LR', dial: '+231', flag: '🇱🇷', name: 'Libéria' },
  { code: 'SL', dial: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: 'CV', dial: '+238', flag: '🇨🇻', name: 'Cap-Vert' },
]

const OTHERS: Country[] = [
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '+32',  flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41',  flag: '🇨🇭', name: 'Suisse' },
  { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada' },
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'États-Unis' },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Allemagne' },
  { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italie' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'EG', dial: '+20',  flag: '🇪🇬', name: 'Égypte' },
  { code: 'ZA', dial: '+27',  flag: '🇿🇦', name: 'Afrique du Sud' },
  { code: 'KE', dial: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'ET', dial: '+251', flag: '🇪🇹', name: 'Éthiopie' },
  { code: 'TZ', dial: '+255', flag: '🇹🇿', name: 'Tanzanie' },
  { code: 'UG', dial: '+256', flag: '🇺🇬', name: 'Ouganda' },
  { code: 'RW', dial: '+250', flag: '🇷🇼', name: 'Rwanda' },
]

const ALL_COUNTRIES = [...ECOWAS, ...OTHERS]
// Sort longest dial code first to avoid +1 matching before +229
const SORTED_BY_DIAL = [...ALL_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
const DEFAULT_COUNTRY = ECOWAS[0] // Bénin

function parseValue(value: string): { country: Country; local: string } {
  if (!value) return { country: DEFAULT_COUNTRY, local: '' }
  if (value.startsWith('+')) {
    for (const c of SORTED_BY_DIAL) {
      if (value.startsWith(c.dial)) {
        return { country: c, local: value.slice(c.dial.length) }
      }
    }
  }
  return { country: DEFAULT_COUNTRY, local: value }
}

interface PhoneInputProps {
  value: string
  onChange: (fullNumber: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '00 00 00 00',
  className = '',
  autoFocus = false,
  disabled = false,
}: PhoneInputProps) {
  const { country: parsedCountry, local: parsedLocal } = parseValue(value)
  const [country, setCountry] = useState<Country>(parsedCountry)
  const [local, setLocal]     = useState(parsedLocal)
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Sync on external value change (e.g. form reset)
  useEffect(() => {
    const { country: c, local: l } = parseValue(value)
    setCountry(c)
    setLocal(l)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  function selectCountry(c: Country) {
    setCountry(c)
    setOpen(false)
    setSearch('')
    onChange(c.dial + local)
  }

  function handleLocal(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setLocal(v)
    onChange(country.dial + v)
  }

  const filtered = search.trim()
    ? ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : null

  return (
    <div ref={wrapRef} className={`relative flex gap-2 ${className}`}>
      {/* Country picker trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors whitespace-nowrap flex-shrink-0 h-[42px]"
      >
        <span>{country.flag}</span>
        <span>{country.dial}</span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Local number */}
      <input
        type="tel"
        value={local}
        onChange={handleLocal}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="tel"
        className="input flex-1 min-w-0"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Search field */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un pays…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered ? (
              filtered.length === 0
                ? <p className="text-center text-sm text-gray-400 py-6">Aucun résultat</p>
                : filtered.map(c => (
                    <Row key={c.code} c={c} active={c.code === country.code} onSelect={selectCountry} />
                  ))
            ) : (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50">
                  CEDEAO
                </p>
                {ECOWAS.map(c => (
                  <Row key={c.code} c={c} active={c.code === country.code} onSelect={selectCountry} />
                ))}
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-t border-gray-100">
                  Autres pays
                </p>
                {OTHERS.map(c => (
                  <Row key={c.code} c={c} active={c.code === country.code} onSelect={selectCountry} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ c, active, onSelect }: { c: Country; active: boolean; onSelect: (c: Country) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
        ${active
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <span className="text-base flex-shrink-0">{c.flag}</span>
      <span className="flex-1 truncate">{c.name}</span>
      <span className="text-gray-400 text-xs font-mono">{c.dial}</span>
    </button>
  )
}
