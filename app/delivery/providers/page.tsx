'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Provider = {
  id: string
  display_name: string
  phone: string
  provider_type: 'individual' | 'merchant' | 'company'
  service_area: string | null
  base_fee_fcfa: number | null
  fee_per_km: number | null
  avg_rating: number | null
  nb_deliveries: number
  is_verified: boolean
}

const TYPE_LABELS: Record<string, string> = {
  individual: 'Coursier indépendant',
  merchant:   'Marchand-livreur',
  company:    'Société de livraison',
}

export default function DeliveryProvidersPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('delivery_providers')
      .select('id, display_name, phone, provider_type, service_area, base_fee_fcfa, fee_per_km, avg_rating, nb_deliveries, is_verified')
      .eq('is_active', true)
      .order('avg_rating', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setProviders((data as Provider[]) ?? [])
        setLoading(false)
      })
  }, [])

  async function assignProvider(providerId: string) {
    if (!orderId) return
    setAssigning(providerId)
    const { error } = await supabase
      .from('delivery_orders')
      .update({ provider_id: providerId, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', orderId)
    setAssigning(null)
    if (!error) {
      setDone(providerId)
    } else {
      alert('Erreur : ' + error.message)
    }
  }

  const filtered = providers.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.display_name.toLowerCase().includes(q) ||
      p.service_area?.toLowerCase().includes(q) ||
      TYPE_LABELS[p.provider_type]?.toLowerCase().includes(q)
    )
  })

  if (done) {
    const p = providers.find(p => p.id === done)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Livreur assigné !</h2>
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold">{p?.display_name}</span> a été assigné à cette commande.
          </p>
          <p className="text-xs text-gray-400 mb-5">Le livreur sera notifié par WhatsApp.</p>
          <a href="/merchant/delivery" className="block bg-brand-600 text-white py-3 rounded-xl font-semibold text-sm">
            Voir mes livraisons
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🚴 Livreurs disponibles</h1>
          {orderId && (
            <p className="text-xs text-brand-600 mt-0.5">Assignez un livreur pour cette commande</p>
          )}
        </div>
        <a href="/merchant/delivery" className="text-brand-600 text-sm">← Retour</a>
      </div>

      {/* Recherche */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Nom, zone de couverture, type…"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-400"
      />

      {loading ? (
        <div className="text-center text-gray-400 py-12">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm">Aucun livreur trouvé.</p>
          {!search && (
            <p className="text-gray-400 text-xs mt-2">Aucun livreur actif pour l&apos;instant.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{p.display_name}</span>
                    {p.is_verified && (
                      <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">✓ Vérifié</span>
                    )}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full capitalize">
                      {TYPE_LABELS[p.provider_type] ?? p.provider_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                    {p.avg_rating && (
                      <span className="text-yellow-500 font-medium">★ {p.avg_rating}</span>
                    )}
                    <span>{p.nb_deliveries} livraisons</span>
                    {p.service_area && <span>📍 {p.service_area}</span>}
                  </div>
                  {(p.base_fee_fcfa || p.fee_per_km) && (
                    <div className="mt-1.5 text-xs text-gray-400">
                      {p.base_fee_fcfa && `Forfait de base : ${p.base_fee_fcfa.toLocaleString('fr-FR')} FCFA`}
                      {p.base_fee_fcfa && p.fee_per_km && ' · '}
                      {p.fee_per_km && `+${p.fee_per_km} FCFA/km`}
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-gray-400">
                    📞 <a href={`tel:${p.phone}`} className="hover:text-brand-600">{p.phone}</a>
                    {' · '}
                    <a
                      href={`https://wa.me/${p.phone.replace(/\D/g, '')}?text=Bonjour%2C%20j%27ai%20une%20livraison%20%C3%A0%20vous%20confier.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>

                {/* Bouton assigner */}
                {orderId && (
                  <button
                    onClick={() => assignProvider(p.id)}
                    disabled={assigning === p.id}
                    className="flex-shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning === p.id ? '…' : 'Choisir'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA — s'inscrire comme livreur */}
      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-brand-800 mb-1">Vous êtes livreur ou coursier ?</p>
        <p className="text-xs text-brand-600 mb-3">Inscrivez-vous pour recevoir des commandes dans votre zone.</p>
        <a
          href="/merchant/activate?service=delivery"
          className="inline-block bg-brand-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-brand-700 transition-colors"
        >
          Rejoindre GreenFlame Delivery
        </a>
      </div>
    </div>
  )
}
