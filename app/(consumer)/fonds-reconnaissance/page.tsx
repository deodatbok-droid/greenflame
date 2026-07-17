/**
 * /fonds-reconnaissance — Dashboard du Fonds de Reconnaissance
 * Accessible à tous pour consultation. R3+ voient leurs données réelles.
 */
import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import BackButton         from '@/components/ui/BackButton'
import FondsRecoClient, { type FondsData } from './FondsRecoClient'

const RANK_NAMES: Record<number, string> = {
  3: 'Builder', 4: 'Leader Flamme', 5: 'Leader Brasier', 6: 'Ambassadeur', 7: 'Kingmaker',
}
const FONDS_POIDS: Record<number, number> = { 3: 3, 4: 5, 5: 8, 6: 13, 7: 21 }
const RANK_COLORS: Record<number, string> = {
  3: '#5BAD24', 4: '#4A9DEA', 5: '#8270D4', 6: '#20B08A', 7: '#D94545',
}
const POIDS_SUM = 50

export default async function FondsReconnaisssancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { cookies } = await import('next/headers')
  const cookieHeader = (await cookies()).toString()
  const internalBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: Record<string, any> = { eligible: false }
  try {
    const res = await fetch(`${internalBase}/api/fonds-reconnaissance`, {
      headers: { Cookie: cookieHeader },
      cache:   'no-store',
    })
    data = await res.json()
  } catch {
    // network error; show non-eligible state gracefully
  }

  if (!data.eligible) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-10 pb-2 flex items-center">
          <BackButton href="/carriere" />
        </div>

        <div className="px-4 space-y-4 pt-2">

          {/* Hero verrouillé */}
          <div
            className="rounded-2xl overflow-hidden relative text-white"
            style={{ background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }}
          >
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #f59e0b 0%, transparent 60%)' }} />
            <div className="relative p-5">
              <p className="text-amber-400/80 text-xs font-bold uppercase tracking-widest mb-1">Fonds de Reconnaissance</p>
              <h1 className="text-xl font-black text-white mb-1">Découvrez ce qui vous attend</h1>
              <p className="text-white/60 text-xs leading-relaxed">
                {data.message ?? 'Chaque mois, les leaders qui franchissent un palier reçoivent un bonus de palier déduit depuis leur sous-pool dédié.'}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-xl px-3 py-2">
                <span className="text-amber-300 text-xs font-semibold">🔒 Disponible dès le rang Builder (R3)</span>
              </div>
            </div>
          </div>

          {/* Comment fonctionne le Fonds */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="font-bold text-gray-900 text-sm">Comment fonctionne le Fonds ?</p>
            <div className="space-y-2.5">
              {[
                { icon: '💧', text: '10% de chaque dividende communautaire alimente automatiquement le Fonds global' },
                { icon: '🎯', text: '5 sous-pools permanents — un par palier leader (R3 à R7) — pondérés selon la suite de Fibonacci' },
                { icon: '📅', text: 'Distribution mensuelle le 1er du mois, uniquement aux leaders ayant franchi un palier ce mois-là' },
                { icon: '⚖️', text: '1 seul franchisseur → il reçoit 50% du sous-pool. Plusieurs → 100% partagé au prorata du volume communautaire' },
                { icon: '🔄', text: '10% de chaque bonus de palier versé est réinjecté dans le Fonds pour alimenter les mois suivants' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-gray-600">
                  <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                  <span className="leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Poids Fibonacci par palier */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Bonus de palier potentiel</p>
            <div className="space-y-2.5">
              {[3, 4, 5, 6, 7].map(rank => {
                const poids = FONDS_POIDS[rank]
                const pct   = Math.round((poids / POIDS_SUM) * 100)
                const color = RANK_COLORS[rank]
                return (
                  <div key={rank}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ background: color }}>
                          R{rank}
                        </div>
                        <span className="font-semibold" style={{ color }}>{RANK_NAMES[rank]}</span>
                      </div>
                      <span className="font-bold tabular-nums" style={{ color }}>
                        {poids}/{POIDS_SUM} = {pct}% du Fonds
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              Exemple : si le Fonds Builder (R3) contient 200 000 FCFA et que vous le franchissez seul ce mois-là, vous recevez 100 000 FCFA nets (50% × 200k, moins 10% réinjecté).
            </p>
          </div>

          {/* Règle de partage */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
            <p className="font-bold text-indigo-900 text-sm">⚖️ Règle de partage entre co-franchisseurs</p>
            <div className="space-y-1.5 text-xs text-indigo-800">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 font-bold">1 franchisseur</span>
                <span className="text-indigo-600">→ reçoit 50% du sous-pool (l&apos;autre 50% reste pour le mois suivant)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 font-bold">2+ franchisseurs</span>
                <span className="text-indigo-600">→ 100% partagé entre eux au prorata du volume communautaire de chacun</span>
              </div>
            </div>
          </div>

          {/* Répartition du bonus de palier */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="font-bold text-gray-900 text-sm">💫 Répartition de votre bonus de palier</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Après le 10% réinjecté dans le Fonds, les 90% restants vous appartiennent entièrement.
              Vous recevez une notification avec le montant et choisissez votre répartition :
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Option A', cash: '70%', mat: '30%' },
                { label: 'Option B', cash: '30%', mat: '70%' },
              ].map(opt => (
                <div key={opt.label} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{opt.label}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1 text-gray-500">💵 En espèces</span>
                      <span className="font-bold text-green-600">{opt.cash}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1 text-gray-500">🎁 Matériel</span>
                      <span className="font-bold text-amber-600">{opt.mat}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-semibold text-amber-800">🛍️ La récompense matérielle</p>
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Achetée chez un marchand GreenFlame et remise lors de l&apos;événement GreenFlame suivant — elle profite à toute la communauté.
              </p>
            </div>
          </div>

          {/* CTA */}
          <a href="/carriere" className="block">
            <div
              className="rounded-2xl p-4 flex items-center gap-4 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                🚀
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Progresser vers le rang Builder</p>
                <p className="text-green-200 text-xs mt-0.5">Voir mon Plan de Carrière complet</p>
              </div>
              <span className="text-white text-lg flex-shrink-0">›</span>
            </div>
          </a>

        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-10 pb-2 flex items-center">
          <BackButton href="/carriere" />
        </div>
        <FondsRecoClient data={data as FondsData} />
      </div>
    </div>
  )
}
