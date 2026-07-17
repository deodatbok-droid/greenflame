'use client'

import { useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TauxActivite {
  scopeNiveaux:     number
  pctRequis:        number
  seuilDepenseFcfa: number
}

interface RankConditions {
  affiliesDircts:          number
  affiliesAuRangPrecedent: number | null
  rangPrecedentName:       string | null
  tauxActivite:            TauxActivite
  marchandsTotal:          number
}

interface RankConfig {
  rank:       number
  name:       string
  slug:       string
  color:      string
  rewards:    string[]
  conditions: RankConditions | null
}

interface TacVerrouDetails {
  pctRequis:  number
  seuilFcfa:  number
  scopeCount: number
}

interface CareerVerrous {
  structure: { valid: boolean; current: number; required: number; pct: number }
  volume:    { valid: boolean; current: number; required: number; pct: number; tac: TacVerrouDetails }
  marchands: { valid: boolean; current: number; required: number; pct: number }
}

interface CareerEligibility {
  eligible:     boolean
  nextRank:     number | null
  nextRankName: string | null
  verrous:      CareerVerrous
}

interface CareerHistoryEntry {
  rankFrom:   number
  rankTo:     number
  rankName:   string
  achievedAt: string
}

interface CareerState {
  currentRank:            number
  currentRankName:        string
  rankAchievedAt:         string | null
  directAffiliatesCount:  number
  directAffiliatesAtRank: number
  tacActifsCount:         number
  tacScopeCount:          number
  directMerchantsCount:   number
  networkMerchantsCount:  number
  history:                CareerHistoryEntry[]
}

interface SlotInfo {
  currentMax:   number
  aliveCount:   number
  gateRequired: number
  gateOk:       boolean
  nextRankMax:  number | null
}

interface CareerApiResponse {
  state:       CareerState
  eligibility: CareerEligibility
  rankConfig:  RankConfig | null
  allRanks:    RankConfig[]
  slotInfo:    SlotInfo
  slotsByRank: Record<number, number>
  slotGatePct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('fr-FR') }

function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

function ProgressBar({ pct, valid, color }: { pct: number; valid: boolean; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(4, pct)}%`, background: color ?? (valid ? '#16a34a' : '#9ca3af') }}
      />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="card space-y-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-20 bg-gray-100 rounded-xl" />
      {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
    </div>
  )
}

// ─── Rang dans le ladder ──────────────────────────────────────────────────────

function RankRow({
  rank, currentRank, achievedAt, isLast, nextRank, eligibility, slotsByRank, slotInfo,
}: {
  rank:        RankConfig
  currentRank: number
  achievedAt:  string | null
  isLast:      boolean
  nextRank:    number | null
  eligibility: CareerEligibility
  slotsByRank: Record<number, number>
  slotInfo:    SlotInfo
}) {
  const [open, setOpen] = useState(false)

  const isCurrent  = rank.rank === currentRank
  const isAchieved = rank.rank < currentRank
  const isNext     = rank.rank === nextRank
  const isLocked   = rank.rank > currentRank && !isNext

  const dotStyle = isCurrent
    ? { background: '#16a34a', color: '#fff', boxShadow: '0 0 0 3px #16a34a30' }
    : isAchieved
    ? { background: '#dcfce7', color: '#16a34a', border: '2px solid #86efac' }
    : isNext
    ? { background: '#fff', color: rank.color, border: `2px dashed ${rank.color}` }
    : { background: '#f9fafb', color: '#d1d5db', border: '2px solid #e5e7eb' }

  const tac       = eligibility.verrous.volume.tac
  const rankSlots = slotsByRank[rank.rank] ?? 5

  // Le déblocage de slots ne concerne que les transitions R2→R3, R4→R5, R6→R7
  const prevSlots = rank.rank > 0 ? (slotsByRank[rank.rank - 1] ?? 5) : rankSlots
  const thisRankUnlocksSlots = rankSlots > prevSlots

  return (
    <div className="flex gap-3">

      {/* Colonne connecteur */}
      <div className="flex flex-col items-center flex-shrink-0 w-9">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={dotStyle}>
          {isAchieved ? '✓' : `R${rank.rank}`}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1" style={{ background: isAchieved ? '#86efac' : '#e5e7eb', minHeight: 12 }} />
        )}
      </div>

      {/* Contenu */}
      <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-3'}`}>

        {/* Ligne titre — toujours cliquable */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 pt-1 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate" style={{
              color: isCurrent ? '#16a34a' : isAchieved ? '#16a34a' : isNext ? rank.color : '#9ca3af',
            }}>
              {rank.name}
            </span>
            {rank.rank === 8 && <span className="text-xs">👑</span>}
            {/* Badge slots si ce rang débloque plus de slots */}
            {thisRankUnlocksSlots && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 border border-indigo-100 whitespace-nowrap flex-shrink-0">
                +{rankSlots - prevSlots} slots
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isCurrent && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                En cours
              </span>
            )}
            {isAchieved && achievedAt && (
              <span className="text-[10px] text-gray-400">{fmtMonth(achievedAt)}</span>
            )}
            {isNext && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: rank.color + '15', color: rank.color }}>
                Suivant
              </span>
            )}
            {isLocked && <span className="text-gray-300 text-xs">🔒</span>}
            <span className="text-gray-300 text-xs ml-0.5">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {/* Contenu dépliable */}
        {open && (
          <div className="mt-2 space-y-2">

            {/* ── Récompenses EN PREMIER ── */}
            {rank.rewards.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                  🎁 Ce que ce rang apporte
                </p>
                {rank.rewards.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-900">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">✦</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Conditions d'accès ── */}
            {rank.conditions && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Conditions d&apos;accès à ce rang
                </p>

                {/* Pour le rang SUIVANT : progression réelle + slot gate */}
                {isNext ? (
                  <>
                    {/* Verrou 1 : Structure */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs gap-2">
                        <span className={`flex items-center gap-1 ${eligibility.verrous.structure.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                          <span>{eligibility.verrous.structure.valid ? '✅' : '👥'}</span>
                          <span>
                            {rank.conditions?.affiliesAuRangPrecedent
                              ? `Affiliés ${rank.conditions.rangPrecedentName ?? 'au palier précédent'}`
                              : 'Affiliés directs'}
                          </span>
                        </span>
                        <span className={`font-semibold tabular-nums ${eligibility.verrous.structure.valid ? 'text-green-600' : 'text-gray-500'}`}>
                          {fmt(eligibility.verrous.structure.current)}/{fmt(eligibility.verrous.structure.required)}
                        </span>
                      </div>
                      <ProgressBar pct={eligibility.verrous.structure.pct} valid={eligibility.verrous.structure.valid} />
                    </div>

                    {/* Verrou 2 : TAC */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs gap-2">
                        <span className={`flex items-center gap-1 ${eligibility.verrous.volume.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                          <span>{eligibility.verrous.volume.valid ? '✅' : '💰'}</span>
                          <span>Acheteurs ≥ {fmt(tac.seuilFcfa)} F/mois</span>
                        </span>
                        <span className={`font-semibold tabular-nums ${eligibility.verrous.volume.valid ? 'text-green-600' : 'text-gray-500'}`}>
                          {eligibility.verrous.volume.current}/{eligibility.verrous.volume.required} membres
                        </span>
                      </div>
                      <ProgressBar pct={eligibility.verrous.volume.pct} valid={eligibility.verrous.volume.valid} />
                      {tac.scopeCount > 0 && (
                        <p className="text-[10px] text-gray-400">
                          Objectif : {Math.round(tac.pctRequis * 100)}% de vos {fmt(tac.scopeCount)} membres dans ce périmètre
                        </p>
                      )}
                    </div>

                    {/* Verrou 3 : Marchands */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs gap-2">
                        <span className={`flex items-center gap-1 ${eligibility.verrous.marchands.valid ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                          <span>{eligibility.verrous.marchands.valid ? '✅' : '🏪'}</span>
                          <span>Marchands dans ma communauté</span>
                        </span>
                        <span className={`font-semibold tabular-nums ${eligibility.verrous.marchands.valid ? 'text-green-600' : 'text-gray-500'}`}>
                          {fmt(eligibility.verrous.marchands.current)}/{fmt(eligibility.verrous.marchands.required)}
                        </span>
                      </div>
                      <ProgressBar pct={eligibility.verrous.marchands.pct} valid={eligibility.verrous.marchands.valid} />
                    </div>

                    {/* Slot gate — uniquement si ce rang débloque plus de slots */}
                    {thisRankUnlocksSlots && (
                      <div className="border-t border-gray-200 pt-2.5 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">
                          🔲 Déblocage des {rankSlots} slots après promotion
                        </p>
                        <div className="flex justify-between items-center text-xs gap-2">
                          <span className={`flex items-center gap-1 ${slotInfo.gateOk ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                            <span>{slotInfo.gateOk ? '✅' : '⚡'}</span>
                            <span>Affiliés vivants (actif 30j + ≥2 recrues)</span>
                          </span>
                          <span className={`font-semibold tabular-nums ${slotInfo.gateOk ? 'text-green-600' : 'text-gray-500'}`}>
                            {slotInfo.aliveCount}/{slotInfo.gateRequired}
                          </span>
                        </div>
                        <ProgressBar
                          pct={slotInfo.gateRequired > 0
                            ? Math.min(100, Math.round((slotInfo.aliveCount / slotInfo.gateRequired) * 100))
                            : 100}
                          valid={slotInfo.gateOk}
                          color="#6366f1"
                        />
                        <p className="text-[10px] text-gray-400">
                          {prevSlots} → {rankSlots} slots · 60% des slots actuels doivent être vivants
                        </p>
                      </div>
                    )}

                    {eligibility.eligible && (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <span className="text-green-700 font-bold text-xs">✅ Toutes les conditions sont remplies !</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Pour les autres rangs : seuils requis sans progression */
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span>👥</span>
                        <span>
                          {rank.conditions.affiliesAuRangPrecedent
                            ? 'Affiliés au palier précédent'
                            : 'Affiliés directs'}
                        </span>
                      </span>
                      <span className="font-semibold text-gray-700">
                        {rank.conditions.affiliesAuRangPrecedent
                          ? `${fmt(rank.conditions.affiliesAuRangPrecedent)} affiliés ${rank.conditions.rangPrecedentName ?? 'au rang précédent'}`
                          : `${fmt(rank.conditions.affiliesDircts)} affilié${rank.conditions.affiliesDircts > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1"><span>💰</span><span>Consommateurs actifs</span></span>
                      <span className="font-semibold text-gray-700">
                        {Math.round(rank.conditions.tauxActivite.pctRequis * 100)}% ≥ {fmt(rank.conditions.tauxActivite.seuilDepenseFcfa)} F/mois
                      </span>
                    </div>
                    {rank.conditions.marchandsTotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1"><span>🏪</span><span>Marchands dans ma communauté</span></span>
                        <span className="font-semibold text-gray-700">{fmt(rank.conditions.marchandsTotal)} marchands</span>
                      </div>
                    )}
                    {/* Slots débloqués à ce rang */}
                    <div className="flex justify-between text-xs border-t border-gray-200 pt-1.5 mt-1">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span>🔲</span>
                        <span>Slots directs disponibles</span>
                      </span>
                      <span className="font-semibold text-indigo-600">
                        {rankSlots} slots
                        {thisRankUnlocksSlots && (
                          <span className="text-indigo-400 font-normal"> (+{rankSlots - prevSlots} vs rang précédent)</span>
                        )}
                      </span>
                    </div>
                    {rank.rank === 8 && (
                      <p className="text-xs text-gray-400 italic">Accordé par délibération du Comité GreenFlame</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* R0 et R8 sans conditions standards */}
            {!rank.conditions && rank.rank !== 8 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">Rang de départ — aucune condition requise</p>
                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-400 flex items-center gap-1"><span>🔲</span><span>Slots directs</span></span>
                  <span className="font-semibold text-indigo-600">{rankSlots} slots</span>
                </div>
              </div>
            )}
            {!rank.conditions && rank.rank === 8 && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-xs text-gray-400 italic">Accordé par délibération du Comité GreenFlame</p>
                <div className="flex justify-between text-xs pt-2 border-t border-gray-200">
                  <span className="text-gray-400 flex items-center gap-1"><span>🔲</span><span>Slots directs</span></span>
                  <span className="font-semibold text-indigo-600">{rankSlots} slots</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Panel slots Forced Matrix ────────────────────────────────────────────────

const SLOT_TIERS = [
  { label: 'R0 – R2', slots: 5  },
  { label: 'R3 – R4', slots: 6  },
  { label: 'R5 – R6', slots: 8  },
  { label: 'R7 – R8', slots: 10 },
] as const

function SlotPanel({ slotInfo, directCount, rankColor }: {
  slotInfo:    SlotInfo
  directCount: number
  rankColor:   string
}) {
  const usedPct = slotInfo.currentMax > 0
    ? Math.min(100, Math.round((directCount / slotInfo.currentMax) * 100))
    : 0

  const gatePct = slotInfo.gateRequired > 0
    ? Math.min(100, Math.round((slotInfo.aliveCount / slotInfo.gateRequired) * 100))
    : 100

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">

      {/* Titre + compteur */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          🔲 Slots communauté directe
        </p>
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
          {fmt(directCount)} / {fmt(slotInfo.currentMax)} utilisés
        </span>
      </div>

      {/* Barre d'utilisation */}
      <div className="space-y-1">
        <ProgressBar pct={usedPct} valid={directCount < slotInfo.currentMax} color={rankColor} />
        <p className="text-[10px] text-gray-400">
          {slotInfo.currentMax - directCount > 0
            ? `${slotInfo.currentMax - directCount} place${slotInfo.currentMax - directCount > 1 ? 's' : ''} disponible${slotInfo.currentMax - directCount > 1 ? 's' : ''}`
            : 'Tous les slots sont occupés'}
        </p>
      </div>

      {/* Paliers */}
      <div className="grid grid-cols-4 gap-1.5">
        {SLOT_TIERS.map(tier => {
          const active = slotInfo.currentMax === tier.slots
          return (
            <div key={tier.slots} className={`rounded-xl p-2 text-center border transition-colors ${
              active ? 'bg-white border-indigo-300 shadow-sm' : 'bg-white border-gray-200'
            }`}>
              <p className={`text-sm font-black ${active ? 'text-indigo-600' : 'text-gray-300'}`}>
                {tier.slots}
              </p>
              <p className={`text-[9px] leading-tight mt-0.5 ${active ? 'text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                {tier.label}
              </p>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mx-auto mt-1" />}
            </div>
          )
        })}
      </div>

      {/* Condition de déblocage des nouveaux slots */}
      {slotInfo.nextRankMax && (
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <p className="text-[11px] font-semibold text-indigo-600">
            Prochain palier : {slotInfo.nextRankMax} slots après promotion
          </p>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs gap-2">
              <span className={`flex items-center gap-1 ${slotInfo.gateOk ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                <span>{slotInfo.gateOk ? '✅' : '⚡'}</span>
                <span>Affiliés vivants</span>
              </span>
              <span className={`font-semibold tabular-nums ${slotInfo.gateOk ? 'text-green-600' : 'text-gray-500'}`}>
                {slotInfo.aliveCount} / {slotInfo.gateRequired} requis
              </span>
            </div>
            <ProgressBar pct={gatePct} valid={slotInfo.gateOk} color="#6366f1" />
            <p className="text-[10px] text-gray-400">
              Actif 30j + ≥ 2 recrues · 60% des {slotInfo.currentMax} slots actuels doivent être vivants
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component principal ──────────────────────────────────────────────────────

export default function CareerPlanWidget() {
  const [data,    setData]    = useState<CareerApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/career')
      .then(r => r.json())
      .then((d: CareerApiResponse) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />
  if (!data)   return null

  const { state, eligibility, rankConfig, allRanks, slotInfo, slotsByRank } = data
  const rankColor = rankConfig?.color ?? '#7A7875'

  const ladder = [...allRanks].reverse()

  function getAchievedAt(rank: number): string | null {
    const entry = state.history.find(h => h.rankTo === rank)
    return entry?.achievedAt ?? null
  }

  return (
    <div className="card space-y-4">

      {/* En-tête */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-gray-900">🚀 Carrière Leader</p>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            R{state.currentRank} · {state.currentRankName}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Basé sur votre communauté et vos marchands — indépendant du rang Flamme
        </p>
      </div>

      {/* Hero — rang actuel */}
      <div className="rounded-2xl p-4 flex items-center gap-4 bg-green-50 border border-green-200">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-lg flex-shrink-0 shadow-md bg-green-600">
          R{state.currentRank}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-gray-900 text-xl leading-tight">{state.currentRankName}</p>
          {state.rankAchievedAt
            ? <p className="text-xs text-gray-500 mt-0.5">Obtenu en {fmtMonth(state.rankAchievedAt)}</p>
            : <p className="text-xs text-gray-500 mt-0.5">Rang de départ</p>
          }
          {eligibility.nextRankName && (
            <p className="text-xs font-semibold mt-1.5" style={{ color: rankColor }}>
              Prochain : {eligibility.nextRankName} →
            </p>
          )}
          {state.currentRank === 8 && (
            <p className="text-xs font-bold text-amber-600 mt-0.5">Rang suprême 👑</p>
          )}
        </div>
      </div>

      {/* Métriques communauté */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-gray-900">{fmt(state.directAffiliatesCount)}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Affiliés directs</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-gray-900">{fmt(state.directMerchantsCount)}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Marchands directs</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-base font-black text-gray-900">{fmt(state.networkMerchantsCount)}</p>
          <p className="text-[10px] text-gray-500 leading-tight">Marchands communauté</p>
        </div>
      </div>

      {/* Panel Slots Forced Matrix */}
      <SlotPanel
        slotInfo={slotInfo}
        directCount={state.directAffiliatesCount}
        rankColor={rankColor}
      />

      {/* Ladder R8 → R0 */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-1">
          Parcours complet — appuyez sur un rang pour les détails
        </p>
        {ladder.map((rank, idx) => (
          <RankRow
            key={rank.rank}
            rank={rank}
            currentRank={state.currentRank}
            achievedAt={getAchievedAt(rank.rank)}
            isLast={idx === ladder.length - 1}
            nextRank={eligibility.nextRank}
            eligibility={eligibility}
            slotsByRank={slotsByRank}
            slotInfo={slotInfo}
          />
        ))}
      </div>
    </div>
  )
}
