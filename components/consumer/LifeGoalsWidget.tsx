'use client'

import { useState } from 'react'
import { useLocale } from '@/components/providers/LocaleProvider'
import { formatFcfa } from '@/lib/utils/format'

const LIFE_GOALS_CONFIG = [
  { key: 'dashboard.lifeGoal1' as const, target:  10_000, icon: '🏥' },
  { key: 'dashboard.lifeGoal2' as const, target:  15_000, icon: '👕' },
  { key: 'dashboard.lifeGoal3' as const, target:  20_000, icon: '💡' },
  { key: 'dashboard.lifeGoal4' as const, target:  23_500, icon: '🎲' },
  { key: 'dashboard.lifeGoal5' as const, target:  30_000, icon: '🚗' },
  { key: 'dashboard.lifeGoal6' as const, target:  40_000, icon: '📚' },
  { key: 'dashboard.lifeGoal7' as const, target:  50_000, icon: '🏠' },
  { key: 'dashboard.lifeGoal8' as const, target:  70_000, icon: '🍚' },
  { key: 'dashboard.lifeGoal9' as const, target: 258_500, icon: '⭐' },
]

const AVG_INCOME_PER_MEMBER = 200
const BASE_GOALS_COUNT = LIFE_GOALS_CONFIG.length - 1

export default function LifeGoalsWidget({ monthlyIncome }: { monthlyIncome: number }) {
  const { t } = useLocale()
  const [isOpen, setIsOpen] = useState(false)

  const goals = LIFE_GOALS_CONFIG.map(g => ({ ...g, name: t(g.key) }))
  const coveredBaseCount = goals.slice(0, BASE_GOALS_COUNT).filter(g => monthlyIncome >= g.target).length
  const nextGoal = goals.find((g, i) => monthlyIncome < g.target && (i === 0 || monthlyIncome >= goals[i - 1].target)) ?? null

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header — always visible, toggles on click */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h2 className="font-semibold text-gray-900">{t('dashboard.lifeGoals')}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {coveredBaseCount > 0
              ? t('dashboard.lifeGoalCoveredCount').replace('{covered}', String(coveredBaseCount)).replace('{total}', String(BASE_GOALS_COUNT))
              : t('dashboard.lifeGoalTiers').replace('{n}', String(goals.length))}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible goals list */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-2 space-y-4">
          {goals.map((goal, i) => {
            const pct            = Math.min((monthlyIncome / goal.target) * 100, 100)
            const isDone         = monthlyIncome >= goal.target
            const isNext         = !isDone && (i === 0 || monthlyIncome >= goals[i - 1].target)
            const remaining      = Math.max(goal.target - monthlyIncome, 0)
            const membersNeeded  = Math.ceil(goal.target / AVG_INCOME_PER_MEMBER)

            return (
              <div key={goal.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{goal.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                    {isNext && !isDone && (
                      <span className="text-[10px] font-bold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 ml-1">
                        {t('dashboard.lifeGoalInProgress')}
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-2 py-0.5 ml-1">✓</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatFcfa(goal.target)}{t('dashboard.lifeGoalPerMonth')}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-flame-500 transition-all duration-500"
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                  />
                </div>
                {!isDone && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t('dashboard.lifeGoalRemaining')
                      .replace('{amount}', formatFcfa(remaining))
                      .replace('{n}', membersNeeded.toLocaleString())}
                  </p>
                )}
              </div>
            )
          })}

          {monthlyIncome > 0 && nextGoal && (
            <p className="text-xs text-brand-600 text-center pt-3 border-t border-gray-100">
              💡 {t('dashboard.lifeGoalNudge').replace('{goal}', nextGoal.name)}
            </p>
          )}
          {monthlyIncome === 0 && (
            <p className="text-xs text-gray-400 text-center pt-3 border-t border-gray-100">
              {t('dashboard.lifeGoalFirstPurchase')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
