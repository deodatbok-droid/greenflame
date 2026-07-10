import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import Logo from '@/components/Logo'
import BackButton from '@/components/ui/BackButton'
import { getServerT } from '@/lib/i18n/server'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, locale } = await getServerT()

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    completed:  { label: t('history.completed'),  color: 'text-green-600 bg-green-50'   },
    pending:    { label: t('history.pending'),     color: 'text-yellow-600 bg-yellow-50' },
    processing: { label: t('history.processing'),  color: 'text-blue-600 bg-blue-50'    },
    failed:     { label: t('history.failed'),      color: 'text-red-600 bg-red-50'      },
    refunded:   { label: t('history.refunded'),    color: 'text-gray-600 bg-gray-50'    },
  }

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, amount_fcfa, commission_total, status, payment_method, created_at,
      merchants(business_name),
      commission_distributions(amount_fcfa, distribution_type, is_gfp, level)
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const txList = transactions ?? []

  const grouped = txList.reduce<Record<string, typeof txList>>((acc, tx) => {
    const month = new Date(tx.created_at).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(tx)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white border-b border-gray-100 px-4 py-3 pt-10">
        <div className="flex items-center gap-2 mb-2">
          <Logo size={48} className="w-12 h-12" />
          <span className="font-bold text-brand-700 text-lg">GreenFlame</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-xl">{t('history.myTransactions')}</h1>
          <BackButton href="/dashboard" />
        </div>
        <p className="text-gray-400 text-sm">{txList.length} {t('history.totalSuffix')}</p>
      </div>

      <div className="p-4 space-y-6">
        {txList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛍️</p>
            <p className="font-medium">{t('history.noTransactions')}</p>
            <p className="text-sm mt-1">{t('history.scanToStart')}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, txs]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">
                {month}
              </h2>
              <div className="space-y-2">
                {txs.map(tx => {
                  const merchant = tx.merchants as unknown as { business_name: string } | null
                  const cashbackDist = (tx.commission_distributions as Array<{
                    amount_fcfa: number
                    distribution_type: string
                    is_gfp: boolean
                    level: number
                  }> | null)?.find(d => d.distribution_type === 'cashback')

                  const statusInfo = STATUS_LABELS[tx.status] ?? STATUS_LABELS.pending

                  return (
                    <div key={tx.id} className="card">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                          🛍️
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{merchant?.business_name ?? t('common.unknown')}</p>
                            <p className="font-bold text-right flex-shrink-0">
                              {formatFcfa(tx.amount_fcfa)} FCFA
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`badge ${statusInfo.color}`}>{statusInfo.label}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(tx.created_at).toLocaleDateString(dateLocale, {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {cashbackDist && tx.status === 'completed' && (
                            <p className="text-xs text-brand-600 font-medium mt-1">
                              +{cashbackDist.amount_fcfa} {cashbackDist.is_gfp ? 'GFP' : 'FCFA'} {t('history.cashback')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
