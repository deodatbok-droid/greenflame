'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { GOVERNANCE } from '@/lib/commission-engine/constants'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlocB {
  poids: number
  items: string[]
}

interface RankConditions {
  affiliesDirects:         number
  affiliesAuRangPrecedent: number | null
  rangPrecedentName:       string | null
  tauxActivite: { scopeNiveaux: number; pctRequis: number; seuilDepenseFcfa: number }
  marchandsDirects:  number
  marchandsReseau:   number
  marchandsTotal:    number
}

interface RankData {
  rank:       number
  name:       string
  slug:       string
  color:      string
  blocA:      string[]
  blocB:      BlocB | null
  conditions: RankConditions | null
}

interface CareerVerrous {
  structure: { valid: boolean; current: number; required: number; pct: number }
  volume:    { valid: boolean; current: number; required: number; pct: number; tac: { pctRequis: number; seuilFcfa: number; scopeCount: number } }
  marchands: { valid: boolean; current: number; required: number; pct: number }
}

interface Eligibility {
  eligible:     boolean
  nextRank:     number | null
  nextRankName: string | null
  verrous:      CareerVerrous
}

interface SlotInfo {
  currentMax:   number
  aliveCount:   number
  gateRequired: number
  gateOk:       boolean
  nextRankMax:  number | null
}

interface HistoryEntry {
  rankFrom:   number
  rankTo:     number
  rankName:   string
  achievedAt: string
}

interface NetworkLevel {
  level: number
  label: string
  rate:  number
}

interface Props {
  currentRank:     number
  currentRankName: string
  rankAchievedAt:  string | null
  eligibility:     Eligibility
  slotInfo:        SlotInfo
  slotsByRank:     Record<number, number>
  allRanks:        RankData[]
  history:         HistoryEntry[]
  networkLevels:   NetworkLevel[]
  fondsPoidsTable: Record<number, number>
  dividendeSplit:  { cash: number; voucher: number; recognition: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('fr-FR') }
function pct(n: number) { return `${Math.round(n * 100)}%` }

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(3, value)}%`, background: color }}
      />
    </div>
  )
}

function ProgressArc({ progress, size = 72 }: { progress: number; size?: number }) {
  const r    = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const dash = Math.min(1, Math.max(0, progress / 100)) * circ
  return (
    <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

// ─── Carte d'un palier ───────────────────────────────────────────────────────

function RangCard({
  r, currentRank, nextRank, eligibility, slotInfo, slotsByRank,
}: {
  r: RankData
  currentRank: number
  nextRank: number | null
  eligibility: Eligibility
  slotInfo: SlotInfo
  slotsByRank: Record<number, number>
}) {
  const isAchieved = r.rank < currentRank
  const isCurrent  = r.rank === currentRank
  const isNext     = r.rank === nextRank
  const isLocked   = r.rank > currentRank && !isNext

  const [open, setOpen] = useState(isCurrent || isNext)

  const tac       = eligibility.verrous.volume.tac
  const rankSlots = slotsByRank[r.rank] ?? 5
  const prevSlots = r.rank > 0 ? (slotsByRank[r.rank - 1] ?? 5) : rankSlots

  const cardClass = [
    'rounded-2xl overflow-hidden transition-all',
    isAchieved
      ? 'bg-green-50/60 border border-green-100'
      : isCurrent
      ? 'bg-white border border-gray-100 shadow-md'
      : isNext
      ? 'bg-white border border-gray-100 shadow-sm'
      : 'bg-white border border-gray-100',
  ].join(' ')

  const cardStyle: CSSProperties = isAchieved
    ? { borderLeft: '4px solid #4ade80' }
    : (isCurrent || isNext)
    ? { borderLeft: `4px solid ${r.color}` }
    : {}

  const dotBg     = isAchieved ? '#dcfce7' : isCurrent ? r.color : isNext ? '#fff' : '#f3f4f6'
  const dotColor  = isAchieved ? '#16a34a' : isCurrent ? '#fff'  : isNext ? r.color : '#d1d5db'
  const dotBorder = isNext ? `2px dashed ${r.color}` : 'none'
  const dotShadow = isCurrent ? `0 0 0 4px ${r.color}25` : 'none'

  return (
    <div className={cardClass} style={cardStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/[0.025] transition-colors"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: dotBg, color: dotColor, border: dotBorder, boxShadow: dotShadow }}
        >
          {isAchieved ? '✓' : `R${r.rank}`}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{
              color: isAchieved ? '#16a34a' : isLocked ? '#d1d5db' : r.color,
            }}>
              {r.name}{r.rank === 8 ? ' 👑' : ''}
            </span>
            {isCurrent && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: r.color }}>
                Votre rang
              </span>
            )}
            {isNext && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: r.color + '18', color: r.color, border: `1px solid ${r.color}35` }}>
                Prochain objectif
              </span>
            )}
            {isLocked && <span className="text-gray-300 text-xs">🔒</span>}
          </div>
          {!open && r.blocA.length > 0 && !isLocked && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              🎁 {r.blocA[0]}{r.blocA.length > 1 ? ` +${r.blocA.length - 1}` : ''}
            </p>
          )}
        </div>

        <span className="text-gray-300 text-sm flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-black/5 p-4 space-y-3">

          {/* Bloc A */}
          {r.blocA.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                🎁 Débloqué au franchissement de ce palier
              </p>
              {r.blocA.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-900">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">✦</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Conditions */}
          {r.conditions && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Conditions d&apos;accès
              </p>

              {isNext ? (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs gap-2">
                      <span className={`flex items-center gap-1 ${eligibility.verrous.structure.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                        <span>{eligibility.verrous.structure.valid ? '✅' : '👥'}</span>
                        <span>
                          {r.conditions.affiliesAuRangPrecedent
                            ? `Affiliés ${r.conditions.rangPrecedentName ?? 'au palier précédent'}`
                            : 'Affiliés directs'}
                        </span>
                      </span>
                      <span className={`font-bold tabular-nums ${eligibility.verrous.structure.valid ? 'text-green-600' : 'text-gray-500'}`}>
                        {fmt(eligibility.verrous.structure.current)}/{fmt(eligibility.verrous.structure.required)}
                      </span>
                    </div>
                    <Bar value={eligibility.verrous.structure.pct} color={eligibility.verrous.structure.valid ? '#16a34a' : r.color} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs gap-2">
                      <span className={`flex items-center gap-1 ${eligibility.verrous.volume.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                        <span>{eligibility.verrous.volume.valid ? '✅' : '💰'}</span>
                        <span>Acheteurs ≥ {fmt(tac.seuilFcfa)} F/mois</span>
                      </span>
                      <span className={`font-bold tabular-nums ${eligibility.verrous.volume.valid ? 'text-green-600' : 'text-gray-500'}`}>
                        {eligibility.verrous.volume.current}/{eligibility.verrous.volume.required}
                      </span>
                    </div>
                    <Bar value={eligibility.verrous.volume.pct} color={eligibility.verrous.volume.valid ? '#16a34a' : r.color} />
                    {tac.scopeCount > 0 && (
                      <p className="text-[10px] text-gray-400">
                        {pct(tac.pctRequis)} de vos {fmt(tac.scopeCount)} membres dans le périmètre N1-N{r.conditions.tauxActivite.scopeNiveaux}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs gap-2">
                      <span className={`flex items-center gap-1 ${eligibility.verrous.marchands.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                        <span>{eligibility.verrous.marchands.valid ? '✅' : '🏪'}</span>
                        <span>Marchands dans ma communauté</span>
                      </span>
                      <span className={`font-bold tabular-nums ${eligibility.verrous.marchands.valid ? 'text-green-600' : 'text-gray-500'}`}>
                        {fmt(eligibility.verrous.marchands.current)}/{fmt(eligibility.verrous.marchands.required)}
                      </span>
                    </div>
                    <Bar value={eligibility.verrous.marchands.pct} color={eligibility.verrous.marchands.valid ? '#16a34a' : r.color} />
                  </div>

                  {rankSlots > prevSlots && (
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        🔲 Déblocage des {rankSlots} slots après promotion
                      </p>
                      <div className="flex justify-between text-xs gap-2">
                        <span className={slotInfo.gateOk ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                          {slotInfo.gateOk ? '✅' : '⚡'} Affiliés vivants (actif 30j + ≥2 recrues)
                        </span>
                        <span className={`font-bold tabular-nums ${slotInfo.gateOk ? 'text-green-600' : 'text-gray-500'}`}>
                          {slotInfo.aliveCount}/{slotInfo.gateRequired}
                        </span>
                      </div>
                      <Bar
                        value={slotInfo.gateRequired > 0 ? Math.min(100, Math.round((slotInfo.aliveCount / slotInfo.gateRequired) * 100)) : 100}
                        color="#6366f1"
                      />
                    </div>
                  )}

                  {eligibility.eligible && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <p className="text-green-700 font-bold text-xs">✅ Toutes les conditions sont remplies !</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">👥 {r.conditions.affiliesAuRangPrecedent ? `Affiliés ${r.conditions.rangPrecedentName ?? 'au palier précédent'}` : 'Affiliés directs'}</span>
                    <span className="font-semibold text-gray-700">
                      {r.conditions.affiliesAuRangPrecedent
                        ? `${fmt(r.conditions.affiliesAuRangPrecedent)} affiliés`
                        : `${fmt(r.conditions.affiliesDirects)} affilié${r.conditions.affiliesDirects > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">💰 Acheteurs actifs</span>
                    <span className="font-semibold text-gray-700">
                      {pct(r.conditions.tauxActivite.pctRequis)} ≥ {fmt(r.conditions.tauxActivite.seuilDepenseFcfa)} F/mois (N1-N{r.conditions.tauxActivite.scopeNiveaux})
                    </span>
                  </div>
                  {r.conditions.marchandsTotal > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">🏪 Marchands</span>
                      <span className="font-semibold text-gray-700">
                        {fmt(r.conditions.marchandsDirects)} directs + {fmt(r.conditions.marchandsReseau)} dans la communauté
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function CarriereClient({
  currentRank, currentRankName, rankAchievedAt,
  eligibility, slotInfo, slotsByRank,
  allRanks, history, networkLevels, fondsPoidsTable: _fp, dividendeSplit,
}: Props) {
  const [revenusOpen, setRevenusOpen] = useState(false)
  const currentRankData = allRanks.find(r => r.rank === currentRank)
  const c               = currentRankData?.color ?? '#ea580c'

  const avgPct = eligibility.nextRankName
    ? Math.round((eligibility.verrous.structure.pct + eligibility.verrous.volume.pct + eligibility.verrous.marchands.pct) / 3)
    : 100

  const LEVEL_COLORS = ['#ea580c', '#7c3aed', '#0284c7', '#059669', '#d97706']

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6 pt-2">

      {/* ════ HERO — rang actuel ════ */}
      <div
        className="rounded-2xl overflow-hidden text-white relative"
        style={{ background: `linear-gradient(135deg, ${c} 0%, ${c}b8 100%)` }}
      >
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: 'radial-gradient(circle at 85% 0%, white 0%, transparent 55%)' }} />

        <div className="relative p-5">
          {/* Badge rang + titre */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative flex-shrink-0 w-[72px] h-[72px]">
              {eligibility.nextRankName && <ProgressArc progress={avgPct} size={72} />}
              <div className="absolute inset-[6px] rounded-full bg-white/20 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-white/70 leading-none">R{currentRank}</span>
                <span className="text-xl leading-none mt-0.5">🔥</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.15em]">Parcours Leader</p>
              <h1 className="text-2xl font-black tracking-tight leading-tight">{currentRankName || 'Starter'}</h1>
              {rankAchievedAt && (
                <p className="text-white/60 text-xs mt-0.5">Depuis le {fmtMonth(rankAchievedAt)}</p>
              )}
            </div>
          </div>

          {/* Verrous vers le prochain rang */}
          {eligibility.nextRankName ? (
            <div className="bg-black/15 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-white/70 text-xs">
                  Prochain → <strong className="text-white">{eligibility.nextRankName}</strong>
                </p>
                {eligibility.eligible && (
                  <span className="text-[10px] font-bold bg-green-400/25 text-green-200 px-2 py-0.5 rounded-full border border-green-400/30">
                    ✓ Prêt
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                {[
                  { label: 'Structure', v: eligibility.verrous.structure },
                  { label: 'Activité',  v: eligibility.verrous.volume    },
                  { label: 'Marchands', v: eligibility.verrous.marchands },
                ].map(({ label, v }) => (
                  <div key={label} className="flex-1">
                    <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
                      <span>{v.valid ? '✅' : '○'} {label}</span>
                      <span className="font-bold text-white/80">{v.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${Math.max(3, v.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentRank > 0 ? (
            <div className="bg-black/15 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="text-white font-bold text-sm">Rang maximum atteint !</p>
                <p className="text-white/60 text-xs">Vous êtes au sommet de la communauté GreenFlame.</p>
              </div>
            </div>
          ) : (
            <p className="text-white/70 text-sm mt-1">Effectuez votre premier achat pour démarrer votre parcours.</p>
          )}
        </div>
      </div>

      {/* ════ COMPRENDRE VOS REVENUS ════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setRevenusOpen(o => !o)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div>
            <p className="font-bold text-gray-900 text-sm">💸 Comprendre vos revenus</p>
            <p className="text-xs text-gray-400 mt-0.5">Répartition de chaque commission marchande</p>
          </div>
          <span className={`text-gray-300 text-lg transition-transform duration-200 ${revenusOpen ? 'rotate-90' : ''}`}>›</span>
        </button>
        {revenusOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-50">

          {/* 1. Répartition 4 blocs */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 mt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              Sur chaque achat chez un marchand
            </p>
            {([
              { label: 'Plateforme GreenFlame',       val: GOVERNANCE.PLATFORM_SHARE,       color: '#6b7280' },
              { label: 'Pool événements',              val: GOVERNANCE.REWARDS_FUND_SHARE,   color: '#7c3aed' },
              { label: 'Cashback acheteur',            val: GOVERNANCE.CASHBACK_SHARE,       color: '#16a34a' },
              { label: 'Votre Communauté (N1→N5)',     val: GOVERNANCE.NETWORK_POOL_SHARE,   color: '#ea580c' },
            ] as { label: string; val: number; color: string }[]).map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold" style={{ color: item.color }}>{item.label}</span>
                  <span className="font-black" style={{ color: item.color }}>{pct(item.val)}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: pct(item.val), background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* 2. Cascade N1-N5 */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Les 40% communautaires se répartissent ainsi
            </p>
            <div className="space-y-2">
              {networkLevels.map((l, i) => (
                <div key={l.level}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color: LEVEL_COLORS[i] }}>{l.label}</span>
                    <span className="font-bold" style={{ color: LEVEL_COLORS[i] }}>{pct(l.rate)} de la commission</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(l.rate / GOVERNANCE.NETWORK_LEVELS.L1) * 100}%`, background: LEVEL_COLORS[i] + 'cc' }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              Ex : achat 10 000 F, commission 10% = 1 000 F → N1 reçoit {pct(networkLevels[0].rate)} × 1 000 F = {fmt(Math.round(networkLevels[0].rate * 1000))} F
            </p>
          </div>

          {/* 3. Dividende communautaire split 60/30/10 */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
              Vos dividendes communautaires répartis en 3 catégories
            </p>
            <div className="space-y-2">
              {[
                { label: 'Disponibles pour retrait',  val: dividendeSplit.cash,        color: '#16a34a', desc: 'Versés sur votre wallet' },
                { label: "Bons d'achat GreenFlame",   val: dividendeSplit.voucher,     color: '#7c3aed', desc: 'Utilisables chez les marchands GreenFlame' },
                { label: 'Fonds de Reconnaissance',   val: dividendeSplit.recognition, color: '#ea580c', desc: 'Finance les récompenses dans la communauté' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium" style={{ color: item.color }}>{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{pct(item.val)}</span>
                  </div>
                  <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct(item.val), background: item.color }} />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ════ PALIERS — 8 rangs ════ */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
          Les 8 paliers du Plan de Carrière
        </h2>
        <div className="space-y-2">
          {allRanks.map(r => (
            <RangCard
              key={r.rank}
              r={r}
              currentRank={currentRank}
              nextRank={eligibility.nextRank}
              eligibility={eligibility}
              slotInfo={slotInfo}
              slotsByRank={slotsByRank}
            />
          ))}
        </div>
      </div>

      {/* ════ FONDS DE RECONNAISSANCE ════ */}
      <Link href="/fonds-reconnaissance" className="block">
        <div className="rounded-2xl p-4 flex items-center gap-4 hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }}>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">Fonds de Reconnaissance</p>
            <p className="text-amber-300/80 text-xs mt-0.5">
              {currentRank >= 3
                ? 'Vos sous-pools Fibonacci · Estimations · Historique'
                : 'Bonus de palier · Mécanique du bonus · Disponible dès R3'}
            </p>
          </div>
          {currentRank >= 3
            ? <span className="text-amber-400 text-lg flex-shrink-0">›</span>
            : <span className="text-gray-600 text-sm flex-shrink-0">🔒</span>}
        </div>
      </Link>

      {/* ════ HISTORIQUE DES FRANCHISSEMENTS ════ */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">🏅 Historique des franchissements</p>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((h, i) => {
              const rData = allRanks.find(r => r.rank === h.rankTo)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                    style={{ background: rData?.color ?? '#9ca3af' }}
                  >
                    R{h.rankTo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{h.rankName}</p>
                    <p className="text-xs text-gray-400">{fmtMonth(h.achievedAt)}</p>
                  </div>
                  <span className="text-xs text-gray-300">R{h.rankFrom} → R{h.rankTo}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {history.length === 0 && currentRank === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <p className="text-2xl mb-2">🔥</p>
          <p className="font-semibold text-gray-700 text-sm">Votre aventure commence ici</p>
          <p className="text-gray-400 text-xs mt-1">Faites votre premier achat pour démarrer votre parcours Leader.</p>
          <Link href="/marketplace" className="inline-block mt-3 bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
            Découvrir le Marketplace
          </Link>
        </div>
      )}

    </div>
  )
}
