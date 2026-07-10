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

interface Member { id: string; full_name: string; created_at: string }
interface LevelData {
  level: number
  count: number
  earnings30d: number
  members: Member[]
}

interface Props {
  levels: LevelData[]
  totalEarnings30d: number
  passifMois: number
  referralUrl: string
  totalCount: number
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

export default function NetworkClient({ levels, totalEarnings30d, passifMois, referralUrl, totalCount }: Props) {
  const track = useTrack()
  const { t, locale } = useLocale()
  const [openLevel, setOpenLevel] = useState<number | null>(1)
  const [filleuls, setFilleuls] = useState(3)
  const [depense, setDepense] = useState(20000)

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
  const numLocale  = locale === 'en' ? 'en-US' : 'fr-FR'

  // Signal : utilisateur a vu la page réseau
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
      <div className="mx-4 -mt-8 relative z-10 bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 shadow-lg">
        <p className="text-orange-100 text-xs font-medium uppercase tracking-wider mb-1">{t('network.passiveMonth')}</p>
        <p className="text-white text-4xl font-bold">{formatFcfa(passifMois)} FCFA</p>
        <p className="text-orange-100 text-xs mt-1">{totalCount} {pluralPerson(totalCount)} {t('network.inEcosystem')}</p>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">

        {/* ── LEFT — Réseau réel ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{t('network.myCommunity')}</p>

          {levels.map(({ level, count, earnings30d, members }) => {
            const c = LEVEL_COLORS[level - 1]
            const rate = (LEVEL_RATES[level - 1] * 100).toLocaleString(numLocale, { maximumFractionDigits: 4 })
            const isOpen = openLevel === level
            return (
              <div key={level} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenLevel(isOpen ? null : level)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl ${c.badge} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">N{level}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">
                      {t('network.level')} {level}
                      <span className="ml-2 text-xs font-normal text-gray-400">{count} {pluralPerson(count)} · {rate}{t('network.commissionRate')}</span>
                    </p>
                    {earnings30d > 0 && (
                      <p className="text-brand-600 text-sm font-bold">+{formatFcfa(earnings30d)} {t('network.earnedThisMonth')}</p>
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
                              <p className="font-medium text-gray-900 text-sm truncate">{m.full_name}</p>
                              <p className="text-xs text-gray-400">
                                {t('network.memberSinceDate')} {new Date(m.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
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

          {/* Referral link */}
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

            {/* Simulation results */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">{t('network.level1')}</p>
                  <p className="text-xl font-bold text-white">{formatFcfa(sim.n1)} FCFA</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">{t('network.levels2to5')}</p>
                  <p className="text-xl font-bold text-white">{formatFcfa(sim.n2to5)} FCFA</p>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4 space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">{t('network.monthlyTotal')}</p>
                    <p className="text-3xl font-bold text-brand-400">{formatFcfa(sim.total)} FCFA</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {t('network.perYear').replace('{n}', formatFcfa(sim.total * 12))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs mb-1">{t('network.simCommunity')}</p>
                    <p className="text-2xl font-bold text-white">{sim.totalSimCount.toLocaleString(numLocale)}</p>
                    <p className="text-gray-500 text-xs mt-1">{t('network.peopleTotal')}</p>
                  </div>
                </div>
              </div>

              {/* Per-level breakdown with counts */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {sim.byLevel.map((amount, i) => (
                  <div key={i} className="text-center">
                    <div className={`rounded-lg py-1.5 px-0.5 ${LEVEL_COLORS[i].badge} bg-opacity-30`}>
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

            {/* Assumptions note */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-500">{t('network.assumptions')}</p>
              <p>• {t('network.assumption1')}</p>
              <p>• {t('network.assumption2')}</p>
              <p>• {t('network.assumption3')}</p>
            </div>
          </div>

          {/* Empty state encouragement */}
          {totalCount === 0 && (
            <div className="bg-gradient-to-br from-brand-50 to-orange-50 border border-brand-200 rounded-2xl p-5 text-center">
              <div className="text-4xl mb-3">🔥</div>
              <p className="font-bold text-brand-700 text-lg">{t('network.growTitle')}</p>
              <p className="text-sm text-gray-600 mt-1 mb-4">{t('network.growDesc')}</p>
              <p className="text-xs text-brand-500 font-medium">
                {locale === 'en'
                  ? <>With just 3 referrals spending 20,000 FCFA/month,<br/>you could earn up to {formatFcfa(growPromoFcfa)} FCFA passive/month.</>
                  : <>Avec seulement 3 membres dépensant 20 000 FCFA/mois,<br/>vous pourriez gagner jusqu'à {formatFcfa(growPromoFcfa)} FCFA passifs/mois.</>
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
