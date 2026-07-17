'use client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SousPool {
  rang:           number
  balanceFcfa:    number
  totalAjoute:    number
  totalDistribue: number
  dernierRollup:  string | null
}

interface HistoriqueEntry {
  mois:             string
  rang:             number
  coFranchisseurs:  number
  volumeCommunaute: number
  recompenseBrute:  number
  retourFonds:      number
  recompenseNette:  number
  statut:           string
  verseLe:          string | null
}

export interface FondsData {
  eligible:            boolean
  currentRank:         number
  monthYear:           string
  sousPools:           SousPool[]
  volumeCommunaute:    number
  prochainRang:        number | null
  estimationProchain:  number | null
  historique:          HistoriqueEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RANK_NAMES: Record<number, string> = {
  3: 'Builder',
  4: 'Leader Flamme',
  5: 'Leader Brasier',
  6: 'Ambassadeur',
  7: 'Kingmaker',
}

const RANK_COLORS: Record<number, string> = {
  3: '#5BAD24',
  4: '#4A9DEA',
  5: '#8270D4',
  6: '#20B08A',
  7: '#D94545',
}

const FONDS_POIDS: Record<number, number> = { 3: 3, 4: 5, 5: 8, 6: 13, 7: 21 }
const POIDS_SUM = 50

function fmt(n: number) {
  return n.toLocaleString('fr-FR')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMonth(iso: string) {
  const [y, m] = iso.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// ─── Carte sous-pool ─────────────────────────────────────────────────────────

function SubPoolCard({ sp, currentRank }: { sp: SousPool; currentRank: number }) {
  const color   = RANK_COLORS[sp.rang] ?? '#6b7280'
  const poids   = FONDS_POIDS[sp.rang] ?? 0
  const pct     = Math.round((poids / POIDS_SUM) * 100)
  const isMine  = sp.rang === currentRank
  const isNext  = sp.rang === currentRank + 1

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: isMine  ? color + '12'
                  : isNext  ? color + '08'
                  : '#f9fafb',
        border: isMine  ? `1.5px solid ${color}40`
              : isNext  ? `1.5px dashed ${color}30`
              : '1px solid #f3f4f6',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: color }}>
            R{sp.rang}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{RANK_NAMES[sp.rang] ?? `Rang ${sp.rang}`}</p>
            <p className="text-[10px] text-gray-400">Poids Fibonacci : {poids}/{POIDS_SUM} = {pct}% du fonds</p>
          </div>
        </div>
        <div className="text-right">
          {isMine  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Votre rang</span>}
          {isNext  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: color + '15', color }}>Prochain</span>}
        </div>
      </div>

      {/* Balance principale */}
      <div className="bg-white rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 font-medium">Balance disponible</p>
          <p className="text-xl font-black" style={{ color }}>
            {fmt(sp.balanceFcfa)} <span className="text-xs font-normal text-gray-400">FCFA</span>
          </p>
        </div>
        {sp.dernierRollup && (
          <div className="text-right">
            <p className="text-[9px] text-gray-400">Dernier rollup</p>
            <p className="text-[10px] font-semibold text-gray-600">{fmtMonth(sp.dernierRollup)}</p>
          </div>
        )}
      </div>

      {/* Stats cumulées */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/60 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-gray-400">Total alimenté</p>
          <p className="text-xs font-bold text-gray-700">{fmt(sp.totalAjoute)} F</p>
        </div>
        <div className="bg-white/60 rounded-xl p-2.5 text-center">
          <p className="text-[9px] text-gray-400">Total distribué</p>
          <p className="text-xs font-bold text-gray-700">{fmt(sp.totalDistribue)} F</p>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function FondsRecoClient({ data }: { data: FondsData }) {
  const currentColor = RANK_COLORS[data.currentRank] ?? '#ea580c'

  return (
    <div className="px-4 space-y-5 pt-2">

      {/* ════ HERO ════ */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #1c1917 0%, #292524 100%)` }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #f59e0b 0%, transparent 60%)' }}
        />
        <div className="relative">
          <p className="text-amber-400/80 text-xs font-bold uppercase tracking-widest mb-1">Fonds de Reconnaissance</p>
          <h1 className="text-xl font-black text-white">Vos sous-pools Fibonacci</h1>
          <p className="text-white/60 text-xs mt-1">
            Mis à jour le 1er de chaque mois · {data.monthYear}
          </p>

          {/* Volume communautaire */}
          {data.volumeCommunaute > 0 && (
            <div className="mt-3 bg-white/10 rounded-xl p-3">
              <p className="text-white/70 text-xs mb-0.5">Volume communautaire ce mois</p>
              <p className="text-amber-300 font-black text-lg">{fmt(data.volumeCommunaute)} <span className="text-xs font-normal text-white/60">FCFA générés</span></p>
              <p className="text-white/50 text-[10px] mt-0.5">Dividendes bruts de votre communauté tracés dans le Fonds</p>
            </div>
          )}

          {/* Estimation prochain franchissement */}
          {data.estimationProchain != null && data.prochainRang != null && (
            <div className="mt-2 bg-amber-500/20 border border-amber-500/30 rounded-xl p-3">
              <p className="text-amber-300 text-xs font-semibold mb-0.5">
                Si vous franchissez R{data.prochainRang} ({RANK_NAMES[data.prochainRang] ?? ''}) ce mois…
              </p>
              <p className="text-white font-black text-xl">
                ≈ {fmt(data.estimationProchain)} <span className="text-xs font-normal text-white/60">FCFA nets estimés</span>
              </p>
              <p className="text-white/40 text-[9px] mt-0.5">
                Estimation conservative (net après 10% retour). Part réelle dépend des co-franchisseurs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ════ EXPLICATION MÉCANIQUE ════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="font-bold text-gray-900 text-sm">Comment fonctionne le Fonds ?</p>
        <div className="space-y-2">
          {[
            { icon: '💧', text: '10% de chaque dividende communautaire alimente le Fonds global' },
            { icon: '🎯', text: '5 sous-pools permanents, un par palier (R3 à R7), pondérés selon Fibonacci' },
            { icon: '📅', text: 'Distribution mensuelle : uniquement aux leaders qui ont franchi un palier ce mois-là' },
            { icon: '⚖️', text: '1 seul franchisseur → 50% du sous-pool. 2+ → 100% au prorata du volume communautaire' },
            { icon: '🔄', text: '10% de chaque bonus de palier versé est réinjecté dans le Fonds pour les mois suivants' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ════ RÉPARTITION DU BONUS DE PALIER ════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="font-bold text-gray-900 text-sm">💫 Répartition de votre bonus de palier</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Lors du franchissement, vous recevez une notification et choisissez comment répartir les 90% nets :
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
                  <span className="text-gray-500">💵 En espèces</span>
                  <span className="font-bold text-green-600">{opt.cash}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">🎁 Matériel</span>
                  <span className="font-bold text-amber-600">{opt.mat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-amber-800">🛍️ La récompense matérielle</p>
          <p className="text-[10px] text-amber-700 leading-relaxed">
            Achetée chez un marchand GreenFlame · Remise lors de l&apos;événement GreenFlame suivant.
          </p>
        </div>
      </div>

      {/* ════ SOUS-POOLS ════ */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
          Les 5 sous-pools — balances en temps réel
        </p>
        <div className="space-y-2">
          {data.sousPools.map(sp => (
            <SubPoolCard key={sp.rang} sp={sp} currentRank={data.currentRank} />
          ))}
        </div>
      </div>

      {/* ════ RÉPARTITION DES POIDS ════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          Poids Fibonacci par palier
        </p>
        <div className="space-y-2">
          {[3, 4, 5, 6, 7].map(rank => {
            const poids = FONDS_POIDS[rank]
            const pct   = Math.round((poids / POIDS_SUM) * 100)
            const color = RANK_COLORS[rank]
            return (
              <div key={rank}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium" style={{ color }}>R{rank} — {RANK_NAMES[rank]}</span>
                  <span className="font-bold" style={{ color }}>{poids}/{POIDS_SUM} = {pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Plus le palier est élevé, plus le bonus de palier est important. Les Kingmakers reçoivent 42% du fonds s&apos;ils franchissent ce palier.
        </p>
      </div>

      {/* ════ HISTORIQUE DES BONUS DE PALIER ════ */}
      {data.historique.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              🏅 Vos bonus de palier passés
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.historique.map((h, i) => {
              const color = RANK_COLORS[h.rang] ?? '#6b7280'
              return (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                        style={{ background: color }}>
                        R{h.rang}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{RANK_NAMES[h.rang] ?? `Rang ${h.rang}`}</p>
                        <p className="text-[10px] text-gray-400">{fmtMonth(h.mois)} · {h.coFranchisseurs} franchisseur{h.coFranchisseurs > 1 ? 's' : ''} ce mois</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm" style={{ color }}>{fmt(h.recompenseNette)} F</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        h.statut === 'versé' || h.statut === 'verse'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {h.statut === 'versé' || h.statut === 'verse' ? '✓ Versé' : '⏳ En attente'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
                    <div className="bg-gray-50 rounded-lg py-1">
                      <p className="text-gray-400">Brut</p>
                      <p className="font-semibold text-gray-700">{fmt(h.recompenseBrute)} F</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-1">
                      <p className="text-gray-400">Retour fonds</p>
                      <p className="font-semibold text-gray-700">{fmt(h.retourFonds)} F</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-1">
                      <p className="text-gray-400">Mon volume</p>
                      <p className="font-semibold text-gray-700">{fmt(h.volumeCommunaute)} F</p>
                    </div>
                  </div>
                  {h.verseLe && (
                    <p className="text-[9px] text-gray-400">Versé le {fmtDate(h.verseLe)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <p className="text-3xl mb-2">🏆</p>
          <p className="font-semibold text-gray-700 text-sm">Aucun bonus de palier reçu pour l&apos;instant</p>
          <p className="text-gray-400 text-xs mt-1">
            Les bonus de palier sont versés le 1er de chaque mois si vous avez franchi un palier.
          </p>
          <a href="/carriere" className="inline-block mt-3 bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
            Voir mon Plan de Carrière
          </a>
        </div>
      )}

    </div>
  )
}
