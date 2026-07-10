import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import WithdrawButton from '@/components/consumer/WithdrawButton'
import DonutChart, { type DonutSegment } from '@/components/consumer/DonutChart'
import PendingWithdrawValidations from '@/components/consumer/PendingWithdrawValidations'
import Logo from '@/components/Logo'
import BackButton from '@/components/ui/BackButton'
import { getServerT } from '@/lib/i18n/server'
import PageTracker from '@/components/ui/PageTracker'

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerT()

  const BREAKDOWN_SEGMENTS: Array<{ label: string; color: string; key: string }> = [
    { label: t('wallet.breakdown.cashback'), color: '#16a34a', key: 'cashback' },
    { label: t('wallet.breakdown.l1'),       color: '#22c55e', key: 'l1' },
    { label: t('wallet.breakdown.l2'),       color: '#ea580c', key: 'l2' },
    { label: t('wallet.breakdown.l3'),       color: '#f97316', key: 'l3' },
    { label: t('wallet.breakdown.l4'),       color: '#eab308', key: 'l4' },
    { label: t('wallet.breakdown.l5'),       color: '#fbbf24', key: 'l5' },
  ]

  const LEDGER_LABELS: Record<string, { label: string; icon: string }> = {
    cashback:               { label: t('wallet.ledger.cashback'),                  icon: '💚' },
    commission_network:     { label: t('wallet.ledger.commission_network'),        icon: '🌐' },
    platform_fee:           { label: t('wallet.ledger.platform_fee'),              icon: '🏦' },
    mobile_money_deposit:   { label: t('wallet.ledger.mobile_money_deposit'),     icon: '📥' },
    mobile_money_withdrawal:{ label: t('wallet.ledger.mobile_money_withdrawal'), icon: '📤' },
    purchase_payment:       { label: t('wallet.ledger.purchase_payment'),          icon: '🛍️' },
    gfp_conversion:         { label: t('wallet.ledger.gfp_conversion'),            icon: '🔄' },
    spillover:              { label: t('wallet.ledger.spillover'),                  icon: '↪️' },
    refund:                 { label: t('wallet.ledger.refund'),                    icon: '↩️' },
    admin_credit:           { label: t('wallet.ledger.admin_credit'),              icon: '🎁' },
  }

  const [walletRes, ledgerRes, distRes, pendingValidationsRes] = await Promise.all([
    supabase.from('wallet_summary').select('*').eq('user_id', user.id).single(),
    supabase
      .from('wallet_ledger')
      .select('id, transaction_type, amount, currency_type, balance_after, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('commission_distributions')
      .select('amount_fcfa, distribution_type, level')
      .eq('recipient_id', user.id),
    supabase
      .from('withdrawal_requests')
      .select('id, amount_fcfa, operator, phone, admin_note, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending_user_validation')
      .order('created_at', { ascending: false }),
  ])

  const wallet      = walletRes.data
  const ledger      = ledgerRes.data ?? []
  const dist        = distRes.data ?? []
  const pendingValidations = pendingValidationsRes.data ?? []
  const balanceFcfa = wallet?.balance_fcfa ?? 0
  const balanceGfp  = wallet?.balance_gfp ?? 0
  const totalEarned = wallet?.total_earned_fcfa ?? 0
  const gfpMin      = GOVERNANCE.GFP_MIN_WITHDRAWAL
  const fcfaMin     = 1000
  // Solde total : FCFA + GFP convertis (1 GFP = 1 FCFA)
  const gfpInFcfa       = Math.floor(balanceGfp * GOVERNANCE.GFP_TO_FCFA_RATE)
  const totalWalletFcfa = balanceFcfa + gfpInFcfa

  const breakdown: Record<string, number> = { cashback: 0, l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 }
  for (const d of dist) {
    if (d.distribution_type === 'cashback') breakdown.cashback += d.amount_fcfa
    else if (d.level === 1) breakdown.l1 += d.amount_fcfa
    else if (d.level === 2) breakdown.l2 += d.amount_fcfa
    else if (d.level === 3) breakdown.l3 += d.amount_fcfa
    else if (d.level === 4) breakdown.l4 += d.amount_fcfa
    else if (d.level === 5) breakdown.l5 += d.amount_fcfa
  }
  const breakdownTotal = Object.values(breakdown).reduce((s, v) => s + v, 0)
  const totalCashback  = breakdown.cashback
  const totalNetwork   = breakdown.l1 + breakdown.l2 + breakdown.l3 + breakdown.l4 + breakdown.l5

  const chartSegments: DonutSegment[] = BREAKDOWN_SEGMENTS.map(s => ({
    label: s.label,
    color: s.color,
    value: breakdown[s.key] ?? 0,
  }))

  const canWithdrawFcfa = balanceFcfa >= fcfaMin
  const canWithdrawGfp  = balanceGfp  >= gfpMin

  return (
    <div className="max-w-4xl mx-auto">
      <PageTracker event="wallet_viewed" />
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-6 pt-10 md:rounded-b-3xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Logo size={48} className="w-12 h-12" />
            <span className="text-white font-bold text-lg">GreenFlame</span>
          </div>
          <BackButton href="/dashboard" label="Dashboard" className="text-brand-200 hover:text-white" />
        </div>
        <p className="text-brand-100 text-sm">{t('wallet.myWallet')}</p>
        <p className="text-white text-4xl font-bold mt-1">{formatFcfa(totalWalletFcfa)}</p>
        <p className="text-brand-200 text-sm mt-0.5">{t('wallet.totalBalance')}</p>
        {/* Détail FCFA + GFP : afficher le sous-FCFA en GFP (ex: 7 FCFA + 5 GFP) */}
        {balanceGfp > 0 && (
          <p className="text-brand-300 text-xs mt-1">
            {formatFcfa(totalWalletFcfa)} FCFA{balanceGfp % 10 > 0 ? ` + ${balanceGfp % 10} GFP` : ''}
          </p>
        )}

        {/* GFP block */}
        {balanceGfp > 0 && (
          <div className="mt-3 bg-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-200 text-xs mb-0.5">GreenFlame Points (GFP)</p>
                <p className="text-white text-2xl font-bold">{balanceGfp.toLocaleString()} GFP</p>
                <p className="text-brand-300 text-xs">
                  {formatFcfa(gfpInFcfa)} FCFA{balanceGfp % 10 > 0 ? ` + ${balanceGfp % 10} GFP` : ''} (10 GFP = 1 FCFA)
                </p>
              </div>
              {canWithdrawGfp ? (
                <span className="text-xs font-medium text-green-300 bg-green-500/20 px-3 py-1.5 rounded-full">
                  {t('wallet.readyToWithdraw')}
                </span>
              ) : (
                <div className="text-right">
                  <p className="text-brand-300 text-xs">{(gfpMin - balanceGfp).toLocaleString()} GFP {t('wallet.remaining')}</p>
                  <div className="mt-1 h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-300 rounded-full"
                      style={{ width: `${Math.min((balanceGfp / gfpMin) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Withdraw button */}
        {(canWithdrawFcfa || canWithdrawGfp) && (
          <div className="mt-4">
            <WithdrawButton
              balanceFcfa={balanceFcfa}
              balanceGfp={balanceGfp}
              canWithdrawFcfa={canWithdrawFcfa}
              canWithdrawGfp={canWithdrawGfp}
              minFcfa={fcfaMin}
              minGfp={gfpMin}
            />
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Validations en attente (retraits initiés par admin) */}
        {pendingValidations.length > 0 && (
          <PendingWithdrawValidations requests={pendingValidations} />
        )}

        {/* Earnings breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">{t('wallet.totalEarned')}</p>
            <p className="font-bold text-gray-900 text-base">{formatFcfa(totalEarned)}</p>
            <p className="text-xs text-gray-400">FCFA</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">{t('wallet.directCashback')}</p>
            <p className="font-bold text-brand-600 text-base">{formatFcfa(totalCashback)}</p>
            <p className="text-xs text-gray-400">FCFA</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">{t('wallet.networkDividend')}</p>
            <p className="font-bold text-indigo-600 text-base">{formatFcfa(totalNetwork)}</p>
            <p className="text-xs text-gray-400">FCFA</p>
          </div>
        </div>

        {/* Origine de vos revenus */}
        <div className="card">
          <p className="font-semibold text-gray-900 mb-4">{t('wallet.myEarnings')}</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <DonutChart segments={chartSegments} />
            <div className="w-full sm:flex-1 space-y-1.5">
              {BREAKDOWN_SEGMENTS.map(seg => {
                const val = breakdown[seg.key] ?? 0
                const pct = breakdownTotal > 0 ? Math.round((val / breakdownTotal) * 100) : 0
                return (
                  <div key={seg.key} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-xs text-gray-600 flex-1 truncate">{seg.label}</span>
                    <span className="text-xs font-semibold text-gray-900 tabular-nums">{pct}%</span>
                  </div>
                )
              })}
              {breakdownTotal === 0 && (
                <p className="text-xs text-gray-400 italic">{t('wallet.noEarnings')}</p>
              )}
            </div>
          </div>
        </div>

        {/* GFP info */}
        <div className="card bg-brand-50 border-brand-100">
          <h3 className="font-semibold text-brand-800 text-sm mb-2">{t('wallet.gfpPoints')}</h3>
          <p className="text-xs text-brand-700">{t('wallet.gfpRate')}</p>
        </div>

        {/* Minimum withdrawal info */}
        {!canWithdrawFcfa && balanceFcfa > 0 && (
          <div className="card bg-amber-50 border-amber-200">
            <p className="text-amber-800 text-sm font-medium">
              {t('wallet.minWithdrawFcfa').replace('{amount}', formatFcfa(fcfaMin))}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">
              {t('wallet.minWithdrawRemaining').replace('{amount}', formatFcfa(fcfaMin - balanceFcfa))}
            </p>
          </div>
        )}

        {/* Transaction history */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">{t('wallet.history')}</h2>
          {ledger.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm font-medium text-gray-600">{t('wallet.noTransactions')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ledger.map(entry => {
                const meta = LEDGER_LABELS[entry.transaction_type] ?? { label: entry.transaction_type, icon: '💳' }
                const isCredit = entry.amount > 0
                const date = new Date(entry.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })
                return (
                  <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCredit ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <span className="text-lg">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{meta.label}</p>
                      <p className="text-xs text-gray-400">{date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                        {isCredit ? '+' : ''}{formatFcfa(entry.amount)}{' '}
                        <span className="text-xs font-medium">{(entry.currency_type ?? 'fcfa').toUpperCase()}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('wallet.ledgerBalance')} {formatFcfa(entry.balance_after)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
