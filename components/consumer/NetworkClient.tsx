'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatFcfa } from '@/lib/utils/format'
import ShareButtons from '@/components/consumer/ShareButtons'
import Logo from '@/components/Logo'
import { useTrack } from '@/lib/hooks/useTrack'
import { useLocale } from '@/components/providers/LocaleProvider'

const COMMISSION_RATE = 0.10
const LEVEL_COLORS = [
  { bg: 'bg-brand-500',  light: 'bg-brand-50',  border: 'border-brand-200',  text: 'text-brand-700',  badge: 'bg-brand-600'  },
  { bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-600' },
  { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-600' },
  { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-600' },
  { bg: 'bg-fuchsia-500',light: 'bg-fuchsia-50',border: 'border-fuchsia-200',text: 'text-fuchsia-700',badge: 'bg-fuchsia-600'},
]
const LEVEL_RATES = [0.12, 0.10, 0.08, 0.06, 0.04]
const LEVEL_HEX   = ['#16a34a', '#4f46e5', '#7c3aed', '#9333ea', '#a21caf']

interface Member {
  id: string; full_name: string; created_at: string; currentRank: number
  isDirect: boolean; isMerchant: boolean; merchantTier: string | null
}
interface LevelData {
  level: number
  count: number
  earnings30d: number
  members: Member[]
}

const CAREER_RANK_NAMES: Record<number, string> = {
  0: 'Starter', 1: 'Étincelle', 2: 'Créateur', 3: 'Builder',
  4: 'Leader Flamme', 5: 'Leader Brasier', 6: 'Ambassadeur', 7: 'Kingmaker', 8: 'Elder',
}
const CAREER_RANK_COLORS: Record<number, string> = {
  0: '#9ca3af', 1: '#D9A43A', 2: '#E87040', 3: '#5BAD24',
  4: '#4A9DEA', 5: '#8270D4', 6: '#20B08A', 7: '#D94545', 8: '#C49B1A',
}

interface Props {
  levels: LevelData[]
  totalEarnings30d: number
  passifMois: number
  referralUrl: string
  totalCount: number
  memberSubCounts: Record<string, number>
  l1Total: number
}

function avatarColor(name: string) {
  const colors = ['bg-emerald-400','bg-sky-400','bg-violet-400','bg-orange-400','bg-pink-400','bg-teal-400','bg-amber-400']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % colors.length
  return colors[hash]
}

function initials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900">{format(value)}</span>
      </div>
      <div className="relative h-2 bg-gray-200 rounded-full">
        <div className="absolute h-2 bg-gradient-to-r from-brand-500 to-orange-400 rounded-full" style={{ width: `${pct}%` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
        <div
          className="absolute w-5 h-5 bg-white border-2 border-brand-500 rounded-full shadow-md -translate-y-1.5 -translate-x-2.5 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const NODE_W = 88

function CommunityTree({
  members,
  subCounts,
  l1Total,
}: {
  members: Member[]
  subCounts: Record<string, number>
  l1Total: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedMember = members.find(m => m.id === selectedId) ?? null

  const showExtra = l1Total > members.length
  const allNodes: (Member | null)[] = [...members, ...(showExtra ? [null] : [])]
  const containerW = Math.max(allNodes.length * NODE_W, 280)

  if (members.length === 0) {
    return (
      <div className="py-8 px-4 text-center">
        <p className="text-3xl mb-2">🌱</p>
        <p className="text-sm font-semibold text-gray-600">Votre arborescence est vide</p>
        <p className="text-xs text-gray-400 mt-1">Invitez vos premiers membres pour voir votre communauté ici</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto py-4 pb-3">
        <div style={{ width: containerW, margin: '0 auto' }}>

          {/* Noeud racine (Vous) */}
          <div className="flex justify-center mb-0">
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-md flex items-center justify-center border-2 border-white">
                <span className="text-xl">🔥</span>
              </div>
              <span className="text-xs font-bold text-gray-800">Vous</span>
              <span className="text-[10px] font-semibold text-brand-600">
                {l1Total} affilié{l1Total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tige verticale depuis la racine */}
          <div className="flex justify-center">
            <div className="w-px h-6 bg-gray-200" />
          </div>

          {/* Rangée enfants avec connecteurs horizontaux */}
          <div className="flex">
            {allNodes.map((m, i) => {
              const isFirst = i === 0
              const isLast  = i === allNodes.length - 1

              const topBar = (
                <div className="relative w-full" style={{ height: 1 }}>
                  <div
                    className="absolute top-0 h-px bg-gray-200"
                    style={{ left: isFirst ? '50%' : 0, right: isLast ? '50%' : 0 }}
                  />
                </div>
              )
              const vertStem = (
                <div className="flex justify-center">
                  <div className="w-px h-5 bg-gray-200" />
                </div>
              )

              if (m === null) {
                return (
                  <div key="extra" style={{ width: NODE_W }} className="flex flex-col items-center">
                    {topBar}{vertStem}
                    <div className="flex flex-col items-center gap-0.5 px-1">
                      <div className="w-11 h-11 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400">+{l1Total - members.length}</span>
                      </div>
                      <span className="text-[9px] text-gray-400 text-center mt-0.5">autres</span>
                    </div>
                  </div>
                )
              }

              const sub      = subCounts[m.id] ?? 0
              const isActive = selectedId === m.id
              return (
                <div
                  key={m.id} style={{ width: NODE_W }}
                  className="flex flex-col items-center cursor-pointer"
                  role="button" tabIndex={0}
                  onClick={() => setSelectedId(p => p === m.id ? null : m.id)}
                  onKeyDown={e => e.key === 'Enter' && setSelectedId(p => p === m.id ? null : m.id)}
                >
                  {topBar}{vertStem}
                  <div className="flex flex-col items-center gap-0.5 px-1">
                    <div className={`w-11 h-11 rounded-full ${avatarColor(m.full_name)} flex items-center justify-center shadow-sm border-2 flex-shrink-0 transition-all ${
                      isActive ? 'border-brand-400 ring-2 ring-brand-300 ring-offset-1 scale-110' : 'border-white'
                    }`}>
                      <span className="text-white font-bold text-sm">{initials(m.full_name)}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 text-center leading-tight truncate w-full">
                      {m.full_name.split(' ')[0]}
                    </span>
                    {m.isMerchant && (
                      <span className="text-[7px] font-bold px-1 py-px rounded-full leading-none whitespace-nowrap bg-amber-100 text-amber-700">
                        🏪
                      </span>
                    )}
                    {m.currentRank > 0 && (
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap"
                        style={{
                          background: CAREER_RANK_COLORS[m.currentRank] + '20',
                          color: CAREER_RANK_COLORS[m.currentRank],
                        }}
                      >
                        {CAREER_RANK_NAMES[m.currentRank]}
                      </span>
                    )}
                    {sub > 0 && (
                      <div className="flex flex-col items-center mt-0.5">
                        <div className="w-px h-2 bg-gray-200" />
                        <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                          {sub}&nbsp;↓
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panneau de détail — apparaît sous l'arbre au tap/clic */}
      {selectedMember && (
        <div className="mx-4 mb-3 bg-gray-900 text-white rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${avatarColor(selectedMember.full_name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white font-bold text-sm">{initials(selectedMember.full_name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{selectedMember.full_name}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {selectedMember.isMerchant ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    🏪 Marchand{selectedMember.merchantTier === 'vip' ? ' VIP' : selectedMember.merchantTier === 'agent' ? ' Agent' : ''}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                    🛒 Consommateur
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  selectedMember.isDirect
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {selectedMember.isDirect ? '✅ Affilié direct' : '🔄 Placé par spillover'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-500 hover:text-white transition-colors p-1 flex-shrink-0 leading-none text-lg"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NetworkClient({ levels, totalEarnings30d, passifMois, referralUrl, totalCount, memberSubCounts, l1Total }: Props) {
  const track = useTrack()
  const { t, locale } = useLocale()
  const [openLevel, setOpenLevel] = useState<number | null>(1)
  const [filleuls, setFilleuls] = useState(3)
  const [depense, setDepense] = useState(20000)

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
  const numLocale  = locale === 'en' ? 'en-US' : 'fr-FR'

  useEffect(() => { track('network_viewed', { total_count: totalCount }) }, [track, totalCount])

  const sim = useMemo(() => {
    const levelData = LEVEL_RATES.map((rate, i) => {
      const count    = Math.pow(filleuls, i + 1)
      const earnings = Math.floor(count * depense * COMMISSION_RATE * rate)
      return { count, earnings }
    })
    const byLevel       = levelData.map(l => l.earnings)
    const counts        = levelData.map(l => l.count)
    const n1            = byLevel[0]
    const n2to5         = byLevel.slice(1).reduce((s, v) => s + v, 0)
    const totalSimCount = counts.reduce((s, c) => s + c, 0)
    return { n1, n2to5, total: n1 + n2to5, byLevel, counts, totalSimCount }
  }, [filleuls, depense])

  function pluralPerson(n: number) {
    return n !== 1 ? t('network.personsSuffixPlural') : t('network.personsSuffix')
  }

  const growPromoFcfa = Math.floor(3*20000*0.10*0.12 + 9*20000*0.10*0.10 + 27*20000*0.10*0.08 + 81*20000*0.10*0.06 + 243*20000*0.10*0.04)

  const n2to5Earnings = levels.slice(1).reduce((s, l) => s + l.earnings30d, 0)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header avec photo ── */}
      <div className="relative overflow-hidden bg-brand-800 px-4 pt-10 pb-16">
        <div className="absolute inset-0">
          <img
            src="/images/communaut%C3%A9%20%E2%80%94%20header.png"
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-900/30 to-brand-800/65" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Logo size={48} className="w-12 h-12" />
            <span className="text-white font-bold text-lg">GreenFlame</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('network.community')}</h1>
          <p className="text-brand-200 text-sm mt-0.5">{t('network.passiveSubtitle')}</p>
        </div>
      </div>

      {/* ── Passive income banner ── */}
      <div className="mx-4 -mt-8 relative z-10 rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5">
          <p className="text-orange-100 text-xs font-medium uppercase tracking-wider mb-1">{t('network.passiveMonth')}</p>
          <p className="text-white text-3xl font-bold tabular-nums">
            {formatFcfa(passifMois)} <span className="text-lg font-normal text-orange-200">FCFA</span>
          </p>
          <p className="text-orange-200 text-xs mt-1">{totalCount} {pluralPerson(totalCount)} {t('network.inEcosystem')}</p>
        </div>
        {totalEarnings30d > 0 && (
          <div className="bg-orange-600 grid grid-cols-2 divide-x divide-orange-500/40">
            <div className="px-4 py-2.5">
              <p className="text-orange-300 text-[10px] uppercase tracking-wide font-medium">N1 — Affiliés directs</p>
              <p className="text-white font-bold text-sm tabular-nums">{formatFcfa(levels[0]?.earnings30d ?? 0)} FCFA</p>
            </div>
            <div className="px-4 py-2.5">
              <p className="text-orange-300 text-[10px] uppercase tracking-wide font-medium">N2→N5 — Communauté</p>
              <p className="text-white font-bold text-sm tabular-nums">{formatFcfa(n2to5Earnings)} FCFA</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Arborescence visuelle de communauté ── */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">🌳 Mon arborescence</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totalCount > 0
                ? `${totalCount} membre${totalCount > 1 ? 's' : ''} dans votre communauté`
                : 'Commencez à inviter pour voir votre arbre grandir'}
            </p>
          </div>
        </div>
        <CommunityTree
          members={levels[0]?.members ?? []}
          subCounts={memberSubCounts}
          l1Total={l1Total}
        />
        {l1Total > 0 && (
          <div className="px-4 pb-4 flex items-center gap-3 flex-wrap text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-gray-200 inline-flex items-center justify-center text-[8px] font-bold">AB</span> Appuyez pour les détails</span>
            <span className="flex items-center gap-1"><span className="font-bold">N ↓</span> Sous-affiliés</span>
          </div>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">

        {/* ── LEFT — Communauté réelle ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{t('network.myCommunity')}</p>

          {/* Niveau cards avec bordure colorée */}
          <div className="space-y-2">
            {levels.map(({ level, count, earnings30d, members }) => {
              const hex    = LEVEL_HEX[level - 1]
              const rate   = (LEVEL_RATES[level - 1] * 100).toLocaleString(numLocale, { maximumFractionDigits: 4 })
              const isOpen = openLevel === level
              return (
                <div key={level} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${hex}` }}>
                  <button
                    onClick={() => setOpenLevel(isOpen ? null : level)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ background: hex }}
                    >
                      N{level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">
                          {t('network.level')} {level}
                        </p>
                        <span className="text-xs text-gray-400">{rate}{t('network.commissionRate')}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: hex + '18', color: hex }}>
                          {count} {pluralPerson(count)}
                        </span>
                      </div>
                      {earnings30d > 0 && (
                        <p className="font-bold text-sm mt-0.5" style={{ color: hex }}>
                          +{formatFcfa(earnings30d)} {t('network.earnedThisMonth')}
                        </p>
                      )}
                    </div>
                    <span className={`text-gray-300 text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-50">
                      {count === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                          {level === 1
                            ? t('network.noDirectReferral')
                            : t('network.noIndirectReferral')}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {members.slice(0, 10).map(m => (
                            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                              <div className={`w-9 h-9 rounded-full ${avatarColor(m.full_name)} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-white font-bold text-xs">{initials(m.full_name)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-gray-900 text-sm truncate">{m.full_name}</p>
                                  {m.currentRank > 0 && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{
                                        background: CAREER_RANK_COLORS[m.currentRank] + '20',
                                        color:      CAREER_RANK_COLORS[m.currentRank],
                                      }}
                                    >
                                      {CAREER_RANK_NAMES[m.currentRank]}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <p className="text-xs text-gray-400">
                                    {t('network.memberSinceDate')} {new Date(m.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                  {m.isMerchant && (
                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                      🏪 {m.merchantTier === 'vip' ? 'VIP' : m.merchantTier === 'agent' ? 'Agent' : 'Marchand'}
                                    </span>
                                  )}
                                  {level === 1 && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                      m.isDirect ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {m.isDirect ? '↗ Direct' : '⟳ Spillover'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {members.length > 10 && (
                            <p className="px-4 py-3 text-xs text-gray-400 text-center">
                              + {members.length - 10} {t('network.moreMembers')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Comment sont calculés mes revenus ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">💸 Comment sont calculés mes revenus ?</p>
            </div>
            <div className="px-4 pb-4 space-y-3">

              {/* Répartition 4 blocs */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sur chaque achat chez un marchand</p>
                {[
                  { label: 'Plateforme GreenFlame',    pct: '45%', width: '45%', color: '#6b7280' },
                  { label: 'Pool événements',           pct: '3%',  width: '3%',  color: '#7c3aed' },
                  { label: 'Cashback acheteur',         pct: '12%', width: '12%', color: '#16a34a' },
                  { label: 'Votre Communauté (N1→N5)', pct: '40%', width: '40%', color: '#ea580c' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: item.color }} className="font-semibold">{item.label}</span>
                      <span style={{ color: item.color }} className="font-black">{item.pct}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: item.width, background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Cascade N1-N5 */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Les 40% communautaires se répartissent ainsi :</p>
                {LEVEL_RATES.map((rate, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600">Niveau {i + 1} {i === 0 ? '(vos affiliés directs)' : `(cercle N${i + 1})`}</span>
                      <span className="font-bold" style={{ color: LEVEL_HEX[i] }}>{(rate * 100).toFixed(0)}% de la commission</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(rate / 0.12) * 100}%`, background: LEVEL_HEX[i] }} />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-1">
                  Ex : achat 10 000 F, commission 10% → N1 reçoit {(LEVEL_RATES[0] * 10000 * 0.10).toLocaleString('fr-FR')} F, N2 reçoit {(LEVEL_RATES[1] * 10000 * 0.10).toLocaleString('fr-FR')} F…
                </p>
              </div>

              {/* Dividende communautaire 60/30/10 */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Vos dividendes répartis en 3 catégories</p>
                {[
                  { label: '60% — Disponibles pour retrait',         color: '#16a34a' },
                  { label: "30% — Bons d'achat GreenFlame",          color: '#7c3aed' },
                  { label: '10% — Fonds de Reconnaissance',          color: '#ea580c' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs" style={{ color: item.color }}>
                    <span className="flex-shrink-0">✦</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <a href="/carriere" className="flex items-center justify-between bg-brand-50 rounded-xl px-3 py-2.5 hover:bg-brand-100 transition-colors">
                <span className="text-xs font-semibold text-brand-700">Voir mon Plan de Carrière complet</span>
                <span className="text-brand-500">›</span>
              </a>
            </div>
          </div>

          {/* Lien de parrainage */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">{t('network.referralLink')}</p>
            <div className="bg-gray-50 rounded-xl p-3 font-mono text-xs text-gray-600 break-all mb-3">{referralUrl}</div>
            <ShareButtons referralUrl={referralUrl} />
          </div>
        </div>

        {/* ── RIGHT — Simulateur ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{t('network.simulate')}</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-6">
            <p className="text-sm text-gray-500">{t('network.simulateHint')}</p>

            <Slider
              label={t('network.directReferrals')}
              value={filleuls}
              min={1} max={20} step={1}
              format={v => `${v}`}
              onChange={setFilleuls}
            />
            <Slider
              label={t('network.monthlySpend')}
              value={depense}
              min={5000} max={200000} step={5000}
              format={v => `${formatFcfa(v)} FCFA`}
              onChange={setDepense}
            />

            {/* Résultats de simulation */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">{t('network.level1')}</p>
                  <p className="text-xl font-bold text-white tabular-nums">{formatFcfa(sim.n1)} FCFA</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">{t('network.levels2to5')}</p>
                  <p className="text-xl font-bold text-white tabular-nums">{formatFcfa(sim.n2to5)} FCFA</p>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4 space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">{t('network.monthlyTotal')}</p>
                    <p className="text-3xl font-bold text-brand-400 tabular-nums">{formatFcfa(sim.total)} FCFA</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {t('network.perYear').replace('{n}', formatFcfa(sim.total * 12))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs mb-1">{t('network.simCommunity')}</p>
                    <p className="text-2xl font-bold text-white tabular-nums">{sim.totalSimCount.toLocaleString(numLocale)}</p>
                    <p className="text-gray-500 text-xs mt-1">{t('network.peopleTotal')}</p>
                  </div>
                </div>
              </div>

              {/* Répartition par niveau */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {sim.byLevel.map((amount, i) => (
                  <div key={i} className="text-center">
                    <div className="rounded-lg py-1.5 px-0.5" style={{ background: LEVEL_HEX[i] + '30' }}>
                      <p className="text-gray-400 text-[10px]">L{i+1}</p>
                      <p className="text-white text-[10px] font-bold leading-none">{LEVEL_RATES[i]*100}%</p>
                      <p className="text-gray-300 text-[10px] font-semibold mt-0.5 truncate">
                        {sim.counts[i] >= 1_000_000
                          ? `${(sim.counts[i]/1_000_000).toFixed(1)}M`
                          : sim.counts[i] >= 1_000
                          ? `${(sim.counts[i]/1_000).toFixed(0)}k`
                          : sim.counts[i].toString()}
                      </p>
                    </div>
                    <p className="text-gray-400 text-[10px] mt-1 truncate">{formatFcfa(amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hypothèses */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-500">{t('network.assumptions')}</p>
              <p>• {t('network.assumption1')}</p>
              <p>• {t('network.assumption2')}</p>
              <p>• {t('network.assumption3')}</p>
            </div>
          </div>

          {/* Encouragement état vide */}
          {totalCount === 0 && (
            <div className="bg-gradient-to-br from-brand-50 to-orange-50 border border-brand-200 rounded-2xl p-5 text-center">
              <div className="text-4xl mb-3">🔥</div>
              <p className="font-bold text-brand-700 text-lg">{t('network.growTitle')}</p>
              <p className="text-sm text-gray-600 mt-1 mb-4">{t('network.growDesc')}</p>
              <p className="text-xs text-brand-500 font-medium">
                {locale === 'en'
                  ? <>With just 3 referrals spending 20,000 FCFA/month,<br/>you could earn up to {formatFcfa(growPromoFcfa)} FCFA passive/month.</>
                  : <>Avec seulement 3 membres dépensant 20 000 FCFA/mois,<br/>vous pourriez gagner jusqu&apos;à {formatFcfa(growPromoFcfa)} FCFA passifs/mois.</>
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
