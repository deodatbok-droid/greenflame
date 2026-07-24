'use client'

import { useState } from 'react'
import { TOOLS_CATALOG } from '@/lib/merchant/tools-catalog'
import type { SectoralTool } from '@/lib/merchant/tools-catalog'

interface Props {
  value: string | null
  onChange: (slug: string | null) => void
  businessCategory?: string
  showRequestOption?: boolean
}

export default function SectoralToolPicker({ value, onChange, businessCategory, showRequestOption = true }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [requestSector, setRequestSector] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const available = TOOLS_CATALOG.filter(t => t.status === 'available')
  const comingSoon = TOOLS_CATALOG.filter(t => t.status === 'coming_soon')

  function isSuggested(tool: SectoralTool) {
    return !!businessCategory && tool.targetSectors.includes(businessCategory)
  }

  async function submitRequest() {
    if (!requestSector.trim() || submitting) return
    setSubmitting(true)
    await fetch('/api/merchants/tool-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sector_label: requestSector, tool_slug: null }),
    }).catch(() => {})
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div className="space-y-5">

      {/* Outils disponibles */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Outils disponibles maintenant
        </p>
        <div className="grid grid-cols-2 gap-3">
          {available.map(tool => {
            const isSelected = value === tool.slug
            const suggested = isSuggested(tool)
            return (
              <button
                key={tool.slug}
                type="button"
                onClick={() => onChange(isSelected ? null : tool.slug)}
                className={`relative flex flex-col gap-2 p-3.5 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                    : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase bg-amber-600 text-white px-1.5 py-0.5 rounded-full">
                    ✓ Choisi
                  </span>
                )}
                {!isSelected && suggested && (
                  <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase bg-brand-600 text-white px-1.5 py-0.5 rounded-full">
                    Suggéré
                  </span>
                )}
                <span className="text-2xl leading-none">{tool.icon}</span>
                <div>
                  <p className={`font-semibold text-sm leading-tight ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                    {tool.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{tool.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bientôt disponibles */}
      {comingSoon.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Bientôt disponibles
          </p>
          <div className="grid grid-cols-2 gap-3">
            {comingSoon.map(tool => (
              <div
                key={tool.slug}
                className="relative flex flex-col gap-2 p-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 opacity-65"
              >
                <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase bg-gray-400 text-white px-1.5 py-0.5 rounded-full">
                  Bientôt
                </span>
                <span className="text-2xl leading-none grayscale">{tool.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-500 leading-tight">{tool.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demande sectorielle */}
      {showRequestOption && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {!showForm ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600">Votre secteur n&apos;est pas listé ?</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap"
              >
                Émettre une demande →
              </button>
            </div>
          ) : submitted ? (
            <div className="text-center py-1">
              <p className="text-green-700 font-semibold text-sm">✅ Demande enregistrée !</p>
              <p className="text-xs text-gray-500 mt-1">L&apos;équipe GreenFlame vous contactera sous 48h.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">Décrivez votre secteur d&apos;activité</p>
              <input
                type="text"
                value={requestSector}
                onChange={e => setRequestSector(e.target.value)}
                placeholder="Ex: Pâtisserie, Mécanique auto, Électricité…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={!requestSector.trim() || submitting}
                  className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors"
                >
                  {submitting ? 'Envoi…' : 'Envoyer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 text-sm px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
