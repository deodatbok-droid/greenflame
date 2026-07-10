'use client'

import { useState } from 'react'
import { formatFcfa } from '@/lib/utils/format'
import { useLocale } from '@/components/providers/LocaleProvider'

type MonthDatum = { label: string; gmv: number; net: number; count: number }
type DayDatum   = { label: string; gmv: number; count: number }
type DowDatum   = { label: string; avgGmv: number; count: number }
type HourDatum  = { label: string; gmv: number }

interface Props {
  monthlyData: MonthDatum[]
  dailyData:   DayDatum[]
  dowData:     DowDatum[]
  hourData:    HourDatum[]
}

function BarChart({
  data,
  valueKey,
  labelKey,
  color = 'bg-brand-500',
  formatValue = String,
  height = 'h-36',
}: {
  data: Record<string, number | string>[]
  valueKey: string
  labelKey: string
  color?: string
  formatValue?: (v: number) => string
  height?: string
}) {
  const values = data.map(d => Number(d[valueKey]))
  const max = Math.max(...values, 1)
  const [tooltip, setTooltip] = useState<{ i: number; v: number } | null>(null)

  return (
    <div className="relative">
      {tooltip && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
          {formatValue(tooltip.v)}
        </div>
      )}
      <div className={`flex items-end gap-1 ${height}`}>
        {data.map((d, i) => {
          const v = Number(d[valueKey])
          const pct = max > 0 ? Math.max((v / max) * 100, v > 0 ? 2 : 0) : 0
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
              onMouseEnter={() => setTooltip({ i, v })}
              onMouseLeave={() => setTooltip(null)}
            >
              <div
                className={`w-full rounded-t-md ${color} transition-all group-hover:brightness-110`}
                style={{ height: `${pct}%`, minHeight: v > 0 ? '3px' : '0' }}
              />
              <p className="text-[9px] text-gray-400 text-center leading-tight truncate w-full px-0.5">
                {String(d[labelKey])}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AnalyticsCharts({ monthlyData, dailyData, dowData, hourData }: Props) {
  const { t } = useLocale()
  const [activeMonthView, setActiveMonthView] = useState<'gmv' | 'net' | 'count'>('gmv')
  const [activeDailyView, setActiveDailyView] = useState<'gmv' | 'count'>('gmv')

  const monthViewData = monthlyData.map(d => ({
    label: d.label,
    value: activeMonthView === 'gmv' ? d.gmv : activeMonthView === 'net' ? d.net : d.count,
  }))

  const dailyViewData = dailyData.map(d => ({
    label: d.label,
    value: activeDailyView === 'gmv' ? d.gmv : d.count,
  }))

  const dowViewData = dowData.map(d => ({ label: d.label, value: d.avgGmv }))
  const hourViewData = hourData.filter((_, i) => i >= 6 && i <= 22).map(d => ({ label: d.label, value: d.gmv }))

  const fmt = (v: number) => v > 1000 ? `${Math.round(v / 1000)}k FCFA` : `${v} FCFA`

  return (
    <div className="space-y-4">

      {/* 6 mois */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{t('merchant.analytics.evolution6months')}</p>
          <div className="flex gap-1">
            {(['gmv', 'net', 'count'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveMonthView(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeMonthView === v
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {v === 'gmv' ? 'GMV' : v === 'net' ? 'Net' : 'Txs'}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={monthViewData}
          valueKey="value"
          labelKey="label"
          color={activeMonthView === 'net' ? 'bg-green-500' : activeMonthView === 'count' ? 'bg-purple-400' : 'bg-brand-500'}
          formatValue={activeMonthView === 'count' ? v => `${v} ${t('merchant.analytics.chartSales')}` : fmt}
          height="h-40"
        />
        {/* Summary row */}
        <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
          {monthlyData.slice(-3).map((m, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-gray-400">{m.label}</p>
              <p className="text-sm font-bold text-gray-800">{fmt(m.gmv)}</p>
              <p className="text-xs text-gray-400">{m.count} tx</p>
            </div>
          ))}
        </div>
      </div>

      {/* 30 jours */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{t('merchant.analytics.last30days')}</p>
          <div className="flex gap-1">
            {(['gmv', 'count'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveDailyView(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeDailyView === v
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {v === 'gmv' ? t('merchant.analytics.chartSales') : t('merchant.analytics.chartTx')}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={dailyViewData}
          valueKey="value"
          labelKey="label"
          color={activeDailyView === 'count' ? 'bg-indigo-400' : 'bg-brand-400'}
          formatValue={activeDailyView === 'count' ? v => `${v} ${t('merchant.analytics.chartSales')}` : fmt}
          height="h-32"
        />
      </div>

      {/* Jour de semaine + Heure */}
      <div className="grid md:grid-cols-2 gap-4">

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.avgByDay')}</p>
          <BarChart
            data={dowViewData}
            valueKey="value"
            labelKey="label"
            color="bg-green-500"
            formatValue={fmt}
            height="h-28"
          />
          <p className="text-xs text-gray-400 mt-2 text-center">{t('merchant.analytics.avgGmvByDow')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.activityByHour')}</p>
          <BarChart
            data={hourViewData}
            valueKey="value"
            labelKey="label"
            color="bg-amber-400"
            formatValue={fmt}
            height="h-28"
          />
          <p className="text-xs text-gray-400 mt-2 text-center">{t('merchant.analytics.totalGmvByHour')}</p>
        </div>

      </div>
    </div>
  )
}
