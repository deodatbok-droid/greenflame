import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import { requireAdmin } from '@/lib/utils/admin-guard'
import Link from 'next/link'

export default async function AdminRevenuePage() {
  await requireAdmin()
  const svc = createServiceClient()

  const now           = new Date()
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOf3M     = new Date(now.getFullYear(), now.getMonth() - 2, 1)

  const [
    // Abonnements
    allSubsRes,
    monthSubsRes,
    subsByTierRes,
    // Bons de retrait — frais GreenFlame
    allVoucherFeeRes,
    monthVoucherFeeRes,
    recentVouchersRes,
    // Commissions transactions
    monthTxCommRes,
    allTxCommRes,
    // Marchands actifs par tier
    proCountRes,
    vipCountRes,
    // Historique abonnements récents
    recentSubsRes,
  ] = await Promise.all([
    svc.from('merchant_subscriptions').select('amount_fcfa'),
    svc.from('merchant_subscriptions').select('amount_fcfa').gte('created_at', startOfMonth.toISOString()),
    svc.from('merchant_subscriptions').select('tier, amount_fcfa').gte('created_at', startOf3M.toISOString()),
    svc.from('withdrawal_vouchers').select('greenflame_fee_fcfa').eq('status', 'redeemed'),
    svc.from('withdrawal_vouchers').select('greenflame_fee_fcfa').eq('status', 'redeemed').gte('redeemed_at', startOfMonth.toISOString()),
    svc.from('withdrawal_vouchers')
      .select('code, amount_fcfa, greenflame_fee_fcfa, redeemed_at, users!sender_id(full_name), merchants!redeemed_by_merchant_id(business_name)')
      .eq('status', 'redeemed')
      .gt('greenflame_fee_fcfa', 0)
      .order('redeemed_at', { ascending: false })
      .limit(10),
    svc.from('commission_distributions')
      .select('amount_fcfa')
      .eq('distribution_type', 'platform')
      .gte('created_at', startOfMonth.toISOString()),
    svc.from('commission_distributions')
      .select('amount_fcfa')
      .eq('distribution_type', 'platform'),
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'pro').gt('subscription_expires_at', now.toISOString()),
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'vip').gt('subscription_expires_at', now.toISOString()),
    svc.from('merchant_subscriptions')
      .select('tier, amount_fcfa, payment_method, created_at, merchants(business_name)')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  // Totaux abonnements
  const totalSubsAllTime = (allSubsRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)
  const totalSubsMonth   = (monthSubsRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)

  // Totaux frais bons
  const totalVoucherAllTime = (allVoucherFeeRes.data ?? []).reduce((s: number, r: { greenflame_fee_fcfa: number }) => s + (r.greenflame_fee_fcfa ?? 0), 0)
  const totalVoucherMonth   = (monthVoucherFeeRes.data ?? []).reduce((s: number, r: { greenflame_fee_fcfa: number }) => s + (r.greenflame_fee_fcfa ?? 0), 0)

  // Totaux commissions transactions
  const totalTxCommMonth   = (monthTxCommRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)
  const totalTxCommAllTime = (allTxCommRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)

  const totalAllTime = totalTxCommAllTime + totalSubsAllTime + totalVoucherAllTime
  const totalMonth   = totalTxCommMonth   + totalSubsMonth   + totalVoucherMonth

  const proCount  = proCountRes.count  ?? 0
  const vipCount  = vipCountRes.count  ?? 0
  const subsCount = proCount + vipCount

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentVouchers = (recentVouchersRes.data ?? []) as unknown as Array<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentSubs     = (recentSubsRes.data ?? []) as unknown as Array<any>

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenus GreenFlame</h1>
          <p className="text-gray-400 text-sm mt-1">
            Toutes les sources de revenus de la plateforme
          </p>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-brand-400 hover:text-brand-300">
          ← Dashboard
        </Link>
      </div>

      {/* Total banner */}
      <div className="bg-gradient-to-br from-brand-800/60 to-brand-900/60 border border-brand-700/50 rounded-2xl p-6">
        <p className="text-brand-300 text-sm mb-1">Total cumulé GreenFlame</p>
        <p className="text-4xl font-bold text-white">{formatFcfa(totalAllTime)} FCFA</p>
        <p className="text-brand-400 text-sm mt-2">
          Ce mois-ci : <span className="font-bold text-white">{formatFcfa(totalMonth)} FCFA</span>
        </p>
      </div>

      {/* 3 Sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Source 1 : Commissions transactions */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-900/60 rounded-lg flex items-center justify-center text-lg">💳</div>
            <div>
              <p className="font-semibold text-white text-sm">Frais transactions</p>
              <p className="text-xs text-gray-400">45% de chaque commission</p>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-400">{formatFcfa(totalTxCommAllTime)}</p>
            <p className="text-xs text-gray-500">FCFA cumulés</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Ce mois-ci</p>
            <p className="text-lg font-bold text-brand-300">{formatFcfa(totalTxCommMonth)} FCFA</p>
          </div>
          <p className="text-xs text-gray-500">
            Automatique — calculé à chaque transaction complétée via l&apos;Edge Function
          </p>
        </div>

        {/* Source 2 : Abonnements */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-900/60 rounded-lg flex items-center justify-center text-lg">👑</div>
            <div>
              <p className="font-semibold text-white text-sm">Abonnements marchands</p>
              <p className="text-xs text-gray-400">Pro + VIP · 10 000 FCFA/mois</p>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-purple-400">{formatFcfa(totalSubsAllTime)}</p>
            <p className="text-xs text-gray-500">FCFA cumulés</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-700/50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">Pro actifs</p>
              <p className="text-xl font-bold text-white">{proCount}</p>
            </div>
            <div className="bg-purple-900/30 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">VIP actifs</p>
              <p className="text-xl font-bold text-purple-300">{vipCount}</p>
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Ce mois-ci</p>
            <p className="text-lg font-bold text-purple-300">{formatFcfa(totalSubsMonth)} FCFA</p>
          </div>
          <p className="text-xs text-gray-500">
            {subsCount} abonnements actifs · Revenu récurrent mensuel
          </p>
        </div>

        {/* Source 3 : Frais bons de retrait */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-900/60 rounded-lg flex items-center justify-center text-lg">🎟️</div>
            <div>
              <p className="font-semibold text-white text-sm">Frais bons de retrait</p>
              <p className="text-xs text-gray-400">0,5% sur chaque bon encaissé</p>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-amber-400">{formatFcfa(totalVoucherAllTime)}</p>
            <p className="text-xs text-gray-500">FCFA cumulés</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Ce mois-ci</p>
            <p className="text-lg font-bold text-amber-300">{formatFcfa(totalVoucherMonth)} FCFA</p>
          </div>
          <p className="text-xs text-gray-500">
            Service VIP uniquement — 0,5% GreenFlame + 0,5% marchand
          </p>
        </div>

      </div>

      {/* Derniers abonnements */}
      <div>
        <h2 className="font-semibold text-white mb-3">Derniers abonnements souscripts</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-400 font-medium">
                <th className="text-left px-4 py-3">Marchand</th>
                <th className="text-center px-4 py-3">Tier</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Méthode</th>
                <th className="text-right px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {recentSubs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Aucun abonnement enregistré
                  </td>
                </tr>
              ) : recentSubs.map((sub, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">
                    {sub.merchants?.business_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      sub.tier === 'vip'
                        ? 'bg-purple-900/40 text-purple-300'
                        : 'bg-brand-900/40 text-brand-300'
                    }`}>
                      {sub.tier === 'vip' ? '👑 VIP' : '⭐ Pro'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-400">
                    +{formatFcfa(sub.amount_fcfa)} F
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {sub.payment_method ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {new Date(sub.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Derniers frais bons */}
      {recentVouchers.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Derniers frais bons de retrait</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400 font-medium">
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-right px-4 py-3">Valeur bon</th>
                  <th className="text-right px-4 py-3">Frais GreenFlame</th>
                  <th className="text-left px-4 py-3">Marchand</th>
                  <th className="text-right px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {recentVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{v.code}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{formatFcfa(v.amount_fcfa)} F</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-400">
                      +{formatFcfa(v.greenflame_fee_fcfa)} F
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {v.merchants?.business_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {new Date(v.redeemed_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
