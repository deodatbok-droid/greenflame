'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Merchant {
  id: string
  business_name: string
  business_category: string
  public_slug: string | null
  address_text: string
  city: string | null
  neighborhood: string | null
  distance_m: number
  merchant_lat: number | null
  merchant_lng: number | null
  subscription_tier: string
  agent_service_active: boolean
}

const RADII = [
  { label: '1 km',  value: 1000 },
  { label: '3 km',  value: 3000 },
  { label: '5 km',  value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
]

const CATEGORIES = [
  'ALIMENTATION', 'TEXTILE', 'BEAUTE', 'ELECTRONIQUE', 'PHARMACIE',
  'RESTAURATION', 'SERVICES', 'ARTISANAT', 'AGRICULTURE', 'AUTRE',
]

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// Leaflet chargé via CDN — types minimaux
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMap    = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMarker = any
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any
    _leafletLoaded?: boolean
  }
}

export default function DecouvrirPage() {
  const mapRef        = useRef<HTMLDivElement>(null)
  const leafletMap    = useRef<LeafletMap>(null)
  const markersRef    = useRef<LeafletMarker[]>([])
  const userMarkerRef = useRef<LeafletMarker>(null)

  const [merchants, setMerchants]     = useState<Merchant[]>([])
  const [loading, setLoading]         = useState(false)
  const [locating, setLocating]       = useState(false)
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius]           = useState(5000)
  const [category, setCategory]       = useState('')
  const [mapReady, setMapReady]       = useState(false)
  const [locError, setLocError]       = useState('')

  // ── Charger Leaflet depuis CDN ──────────────────────────────────────
  useEffect(() => {
    if (window._leafletLoaded) { setMapReady(true); return }

    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => { window._leafletLoaded = true; setMapReady(true) }
    document.head.appendChild(script)
  }, [])

  // ── Initialiser la carte une fois Leaflet prêt ──────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return
    const L = window.L
    // Centre sur Cotonou par défaut
    const map = L.map(mapRef.current, { zoomControl: false }).setView([6.3654, 2.4183], 13)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    leafletMap.current = map
  }, [mapReady])

  // ── Recherche marchands ─────────────────────────────────────────────
  const search = useCallback(async (lat: number, lng: number, r: number, cat: string) => {
    setLoading(true)
    const url = `/api/merchants/search?lat=${lat}&lng=${lng}&radius=${r}${cat ? `&category=${cat}` : ''}`
    const res  = await fetch(url)
    const data = res.ok ? await res.json() : []
    setMerchants(Array.isArray(data) ? data : [])
    setLoading(false)

    if (!leafletMap.current || !window.L) return
    const L = window.L

    // Supprimer anciens markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Ajouter nouveaux markers
    const icon = L.divIcon({
      html: `<div style="width:28px;height:28px;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px">🏪</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const newMarkers: LeafletMarker[] = (data as Merchant[])
      .filter(m => m.merchant_lat != null && m.merchant_lng != null)
      .map(m => {
        const marker = L.marker([m.merchant_lat!, m.merchant_lng!], { icon })
          .bindPopup(`
            <div style="min-width:160px;font-family:sans-serif">
              <strong style="font-size:13px">${m.business_name}</strong><br>
              <span style="font-size:11px;color:#666">${m.business_category}</span><br>
              <span style="font-size:11px">${fmtDist(m.distance_m)}</span>
            </div>
          `)
          .addTo(leafletMap.current!)
        return marker
      })
    markersRef.current = newMarkers

    // Zoomer pour montrer les marchands
    if (newMarkers.length > 0) {
      const group = L.featureGroup(newMarkers)
      leafletMap.current!.fitBounds(group.getBounds().pad(0.2))
    }
  }, [])

  // ── Géolocalisation ─────────────────────────────────────────────────
  function locate() {
    setLocError('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        setLocating(false)

        if (leafletMap.current && window.L) {
          const L = window.L
          userMarkerRef.current?.remove()
          userMarkerRef.current = L.circleMarker([lat, lng], {
            radius: 8, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3,
          }).addTo(leafletMap.current).bindPopup('Vous êtes ici')
          leafletMap.current.setView([lat, lng], 14)
        }

        search(lat, lng, radius, category)
      },
      err => {
        setLocating(false)
        setLocError(err.code === 1 ? 'Accès à la position refusé' : 'Position indisponible')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Re-search quand rayon ou catégorie changent
  useEffect(() => {
    if (coords) search(coords.lat, coords.lng, radius, category)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, category])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">←</Link>
          <h1 className="text-lg font-bold text-white flex-1">Découvrir les marchands</h1>
        </div>

        {/* Bouton localisation */}
        <button
          onClick={locate}
          disabled={locating}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
            coords
              ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
              : 'bg-brand-600 hover:bg-brand-700 text-white'
          }`}
        >
          {locating ? (
            <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Localisation…</>
          ) : coords ? (
            <>📍 Position détectée — relancer</>
          ) : (
            <>📍 Trouver des marchands près de moi</>
          )}
        </button>
        {locError && <p className="text-xs text-red-400 text-center">{locError}</p>}

        {/* Filtres */}
        {coords && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {RADII.map(r => (
              <button
                key={r.value}
                onClick={() => setRadius(r.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  radius === r.value ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {coords && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCategory('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                !category ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? '' : c)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === c ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carte */}
      <div className="relative shrink-0 h-56 bg-gray-800">
        <div ref={mapRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!coords && mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 pointer-events-none">
            <p className="text-gray-400 text-sm">Activez la localisation pour voir la carte</p>
          </div>
        )}
      </div>

      {/* Liste marchands */}
      <div className="flex-1 overflow-y-auto">
        {!coords ? (
          <div className="text-center py-12 text-gray-500 px-4">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium text-gray-400">Trouvez les marchands GreenFlame</p>
            <p className="text-sm mt-1">Activez votre position pour voir les boutiques près de vous</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-12 text-gray-500 px-4">
            <p className="text-4xl mb-3">😔</p>
            <p className="font-medium text-gray-400">Aucun marchand trouvé</p>
            <p className="text-sm mt-1">Essayez un rayon plus large ou une autre catégorie</p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            <p className="text-xs text-gray-500 font-medium">
              {merchants.length} marchand(s) dans un rayon de {fmtDist(radius)}
            </p>
            {merchants.map(m => (
              <MerchantCard key={m.id} merchant={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MerchantCard({ merchant: m }: { merchant: Merchant }) {
  const isVip = m.subscription_tier === 'vip'
  return (
    <div className={`bg-gray-800 rounded-2xl p-4 ${isVip ? 'border border-amber-700/50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate">{m.business_name}</p>
            {isVip && (
              <span className="text-[10px] bg-amber-900/50 text-amber-300 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
            )}
            {m.agent_service_active && (
              <span className="text-[10px] bg-blue-900/50 text-blue-300 font-bold px-1.5 py-0.5 rounded-full">Agent</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {m.business_category.charAt(0) + m.business_category.slice(1).toLowerCase()}
          </p>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {m.neighborhood ? `${m.neighborhood}, ` : ''}{m.city ?? m.address_text}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-brand-400">{fmtDist(m.distance_m)}</p>
        </div>
      </div>
      {m.public_slug && (
        <Link
          href={`/boutique/${m.public_slug}`}
          className="mt-3 block text-center text-xs font-semibold text-brand-400 hover:text-brand-300 bg-brand-900/20 rounded-xl py-2 transition-colors"
        >
          Voir la boutique →
        </Link>
      )}
    </div>
  )
}
