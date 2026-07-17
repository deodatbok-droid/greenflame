import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import { requireAdmin } from '@/lib/utils/admin-guard'
import DigestCard from './DigestCard'

export default async function AdminDashboard() {
  await requireAdmin()
  const svc = createServiceClient()

  const now           = new Date()
  const startOfDay    = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    usersRes,
    merchantsRes,
    todayAgg,
    monthAgg,
    spilloverRes,
    spilloverTotalRes,
    auditRes,
    networkRes,
    pendingWithdrawals,
    recentTxsRes,
    todayTxCountRes,
    subscriptionRevenueRes,
    voucherFeeRevenueRes,
    proMerchantCountRes,
    vipMerchantCountRes,
    latestDigestRes,
  ] = await Promise.all([
    svc.from('users').select('*', { count: 'exact', head: true }),
    svc.from('merchants').select('*', { count: 'exact', head: true }).eq('is_active', true),
    svc.rpc('admin_stats_period', { p_from: startOfDay.toISOString(),  p_to: now.toISOString() }),
    svc.rpc('admin_stats_period', { p_from: startOfMonth.toISOString(), p_to: now.toISOString() }),
    svc.from('spillover_fund').select('amount_fcfa').gte('created_at', startOfMonth.toISOString()),
    svc.from('spillover_fund').select('amount_fcfa'),
    svc.from('governance_audit').select('*').order('created_at', { ascending: false }).limit(10),
    svc.from('network_tree').select('*', { count: 'exact', head: true }),
    svc.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    svc.from('transactions')
      .select('id, amount_fcfa, commission_total, status, created_at, merchants(business_name), buyers:users!buyer_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(6),
    svc.from('transactions').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .eq('status', 'completed'),
    // Revenus abonnements marchands (all time)
    svc.from('merchant_subscriptions').select('amount_fcfa'),
    // Revenus frais bons de retrait GreenFlame (all time)
    svc.from('withdrawal_vouchers').select('greenflame_fee_fcfa').eq('status', 'redeemed'),
    // Comptage marchands Pro
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'pro').gt('subscription_expires_at', now.toISOString()),
    // Comptage marchands VIP
    svc.from('merchants').select('*', { count: 'exact', head: true })
      .eq('subscription_tier', 'vip').gt('subscription_expires_at', now.toISOString()),
    // Dernier rapport IA
    svc.from('admin_digests')
      .select('id, period_date, generated_at, generated_by, summary, findings, recommendations, risk_level')
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const today        = (todayAgg.data  as { gmv: number; commissions: number } | null) ?? { gmv: 0, commissions: 0 }
  const month        = (monthAgg.data  as { gmv: number; commissions: number } | null) ?? { gmv: 0, commissions: 0 }
  const spillovers      = spilloverRes.data ?? []
  const spilloverTotal  = (spilloverTotalRes.data ?? []).reduce((s: number, t: { amount_fcfa: number }) => s + t.amount_fcfa, 0)
  const auditLogs       = auditRes.data   ?? []
  const recentTxs    = (recentTxsRes.data ?? []) as unknown as Array<{
    id: string; amount_fcfa: number; commission_total: number; status: string; created_at: string;
    merchants: { business_name: string } | null;
    buyers: { full_name: string } | null;
  }>

  const gmvToday       = today.gmv   ?? 0
  const commToday      = today.commissions ?? 0
  const gmvMonth       = month.gmv   ?? 0
  const commMonth      = month.commissions ?? 0
  const spilloverMonth = spillovers.reduce((s: number, t: { amount_fcfa: number }) => s + t.amount_fcfa, 0)
  const platformMonth  = Math.floor(commMonth * 0.45)
  const networkMonth   = Math.floor(commMonth * 0.40) - spilloverMonth
  const cashbackMonth  = Math.floor(commMonth * 0.12)
  const rewardsMonth   = Math.floor(commMonth * 0.03)

  const totalUsers   = usersRes.count          ?? 0
  const activeMerch  = merchantsRes.count      ?? 0
  const networkSize  = networkRes.count        ?? 0
  const pendingWd    = pendingWithdrawals.count ?? 0
  const txToday      = todayTxCountRes.count   ?? 0

  // Revenus GreenFlame (all-time)
  const subsRevenue    = (subscriptionRevenueRes.data ?? []).reduce((s: number, r: { amount_fcfa: number }) => s + r.amount_fcfa, 0)
  const voucherRevenue = (voucherFeeRevenueRes.data ?? []).reduce((s: number, r: { greenflame_fee_fcfa: number }) => s + (r.greenflame_fee_fcfa ?? 0), 0)
  // platformMonth already represents 45% of monthly commissions — used in existing section
  const totalGFRevenue = platformMonth + subsRevenue + voucherRevenue

  const proCount       = proMerchantCountRes.count ?? 0
  const vipCount       = vipMerchantCountRes.count ?? 0
  const latestDigest   = latestDigestRes.data ?? null

  const dateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── EN-TÊTE ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vue globale</h1>
          <p className="text-gray-400 text-sm mt-1 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Système opérationnel</span>
        </div>
      </div>

      {/* ── ALERTES ACTIONNABLES ── priorité absolue */}
      {(pendingWd > 0 || auditLogs.length > 0) && (
        <div className="space-y-2">
          {pendingWd > 0 && (
            <Link
              href="/admin/withdrawals"
              className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 hover:bg-yellow-500/15 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="text-yellow-300 font-semibold text-sm">
                    {pendingWd} retrait{pendingWd > 1 ? 's' : ''} en attente de traitement
                  </p>
                  <p className="text-yellow-500 text-xs">Action requise</p>
                </div>
              </div>
              <span className="text-yellow-400 text-sm font-medium">Traiter →</span>
            </Link>
          )}
          {auditLogs.length > 0 && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3">
              <p className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-2">
                🚨 {auditLogs.length} tentative(s) de modification des constantes de gouvernance
              </p>
              <div className="space-y-1">
                {auditLogs.slice(0, 3).map((log: { id: string; field_attempted: string; attempted_value: string; was_blocked: boolean; created_at: string }) => (
                  <p key={log.id} className="text-red-300 text-xs">
                    <span className="font-mono">{log.field_attempted}</span>
                    {' '}→ {log.attempted_value}
                    {' '}· {new Date(log.created_at).toLocaleString('fr-FR')}
                    {log.was_blocked && <span className="ml-2 bg-red-500/30 text-red-300 px-1.5 rounded text-[10px]">BLOQUÉ</span>}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RAPPORT IA QUOTIDIEN ── */}
      <DigestCard digest={latestDigest as Parameters<typeof DigestCard>[0]['digest']} />

      {/* ── KPIs AUJOURD'HUI ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Aujourd&apos;hui</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/transactions"
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors block col-span-2 md:col-span-1"
          >
            <p className="text-gray-400 text-xs mb-3">GMV aujourd&apos;hui</p>
            <p className="text-3xl font-bold text-white tabular-nums">{formatFcfa(gmvToday)}</p>
            <p className="text-xs text-gray-500 mt-1">FCFA encaissés</p>
          </Link>
          {[
            { label: 'Revenu plateforme (45%)', value: formatFcfa(Math.floor(commToday * 0.45)), sub: '45% des commissions', color: 'text-brand-400', href: '/admin/transactions' },
            { label: 'Transactions validées',   value: String(txToday),                          sub: 'aujourd\'hui',        color: 'text-white',       href: '/admin/transactions' },
            { label: 'Alertes gouvernance',     value: String(auditLogs.length),                 sub: auditLogs.length > 0 ? 'À vérifier' : 'RAS', color: auditLogs.length > 0 ? 'text-red-400' : 'text-green-400', href: '/admin/dashboard' },
          ].map(s => (
            <Link key={s.label} href={s.href} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors block">
              <p className="text-gray-400 text-xs mb-3 leading-tight">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── COMMUNAUTÉ & MARCHANDS ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Communauté</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Membres total',      value: totalUsers.toLocaleString('fr-FR'),  color: 'text-white',      href: '/admin/users'        },
            { label: 'Marchands actifs',   value: activeMerch.toLocaleString('fr-FR'), color: 'text-white',      href: '/admin/merchants'    },
            { label: 'Pro actifs',         value: String(proCount),                    color: 'text-purple-400', href: '/admin/merchants'    },
            { label: 'VIP actifs',         value: String(vipCount),                    color: 'text-amber-400',  href: '/admin/merchants'    },
            { label: 'FlameFund ce mois',  value: `${formatFcfa(spilloverMonth)} F`,   color: spilloverMonth > 0 ? 'text-orange-400' : 'text-gray-500', href: '/admin/rewards-fund' },
          ].map(s => (
            <Link key={s.label} href={s.href} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors block">
              <p className="text-gray-400 text-xs mb-2 leading-tight">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── RÉPARTITION DES COMMISSIONS (mois) ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
          Répartition des commissions — {now.toLocaleString('fr-FR', { month: 'long' })}
        </p>
        {/* Barre de proportion des commissions */}
        <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px bg-gray-900">
          <div className="bg-brand-500 transition-all" style={{ width: '45%' }} title="Plateforme 45%" />
          <div className="bg-green-500 transition-all" style={{ width: '40%' }} title="Communauté 40%" />
          <div className="bg-blue-500 transition-all"  style={{ width: '12%' }} title="Cashback 12%" />
          <div className="bg-amber-500 transition-all" style={{ width: '3%' }}  title="Récompenses 3%" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'GMV ce mois',               value: formatFcfa(gmvMonth),    sub: 'FCFA',                       color: 'text-white',      border: 'border-gray-700'    },
            { label: 'Plateforme (45%)',           value: formatFcfa(platformMonth), sub: 'GreenFlame',               color: 'text-brand-400',  border: 'border-brand-800/50'},
            { label: 'Dividendes communauté (40%)', value: formatFcfa(networkMonth), sub: spilloverMonth > 0 ? `FlameFund : ${formatFcfa(spilloverMonth)} F` : 'N1 → N5', color: 'text-green-400', border: 'border-green-900/30' },
            { label: 'Cashback acheteurs (12%)',   value: formatFcfa(cashbackMonth), sub: 'Crédité aux acheteurs',   color: 'text-blue-400',   border: 'border-gray-700'    },
          ].map(c => (
            <div key={c.label} className={`bg-gray-800 rounded-xl p-4 border ${c.border}`}>
              <p className="text-gray-400 text-xs mb-2 leading-tight">{c.label}</p>
              <p className={`text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── REVENUS GREENFLAME ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Revenus GreenFlame (cumulés)</p>
          <Link href="/admin/revenue" className="text-xs text-brand-400 hover:text-brand-300">Détail →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-brand-900/40 rounded-xl p-4 border border-brand-800/50 col-span-2 md:col-span-1">
            <p className="text-gray-400 text-xs mb-2">Total GreenFlame</p>
            <p className="text-2xl font-bold text-brand-300 tabular-nums">{formatFcfa(totalGFRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">FCFA cumulés</p>
          </div>
          {[
            { label: 'Frais transactions (45%)', value: formatFcfa(platformMonth), sub: 'Ce mois-ci',                      color: 'text-brand-400'  },
            { label: 'Abonnements Pro + VIP',    value: formatFcfa(subsRevenue),   sub: `${proCount} Pro · ${vipCount} VIP`, color: 'text-purple-400' },
            { label: 'Frais bons de retrait',    value: formatFcfa(voucherRevenue), sub: '0,5% sur bons encaissés',         color: 'text-amber-400'  },
          ].map(r => (
            <div key={r.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-400 text-xs mb-2 leading-tight">{r.label}</p>
              <p className={`text-xl font-bold tabular-nums ${r.color}`}>{r.value}</p>
              <p className="text-xs text-gray-500 mt-1">{r.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRANSACTIONS RÉCENTES ── */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-white">Transactions récentes</h2>
          <Link href="/admin/transactions" className="text-xs text-brand-400 hover:text-brand-300">Tout voir →</Link>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400 font-medium">
                  <th className="text-left px-4 py-3">Marchand</th>
                  <th className="text-left px-4 py-3">Acheteur</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-center px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {recentTxs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">Aucune transaction</td>
                  </tr>
                ) : recentTxs.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{tx.merchants?.business_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{tx.buyers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-white tabular-nums">{formatFcfa(tx.amount_fcfa)} F</td>
                    <td className="px-4 py-3 text-right text-brand-400 font-medium tabular-nums">+{formatFcfa(tx.commission_total)} F</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tx.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                        tx.status === 'failed'    ? 'bg-red-900/30 text-red-400'     :
                                                   'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {tx.status === 'completed' ? '✓ OK' : tx.status === 'failed' ? '✗ Échec' : '⏳'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums">
                      {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── CONSTANTES DE GOUVERNANCE ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">Constantes de gouvernance</h2>
            <p className="text-xs text-gray-500 mt-0.5">Immuables — toute modification est bloquée et loggée</p>
          </div>
          <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full flex-shrink-0">🔒 Protégées</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'GreenFlame',   pct: '45%', color: 'bg-brand-500', sub: 'Plateforme'      },
            { label: 'Communauté',  pct: '40%', color: 'bg-green-500', sub: 'N1 → N5'         },
            { label: 'Cashback',     pct: '12%', color: 'bg-blue-500',  sub: 'Acheteurs'       },
            { label: 'Récompenses',  pct: '3%',  color: 'bg-amber-500', sub: 'Pool événements' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 bg-gray-900/40 rounded-lg p-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color}`} />
              <div>
                <p className="text-white font-bold text-lg tabular-nums">{item.pct}</p>
                <p className="text-gray-400 text-xs">{item.label}</p>
                <p className="text-gray-600 text-xs">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Communauté : N1 12% · N2 10% · N3 8% · N4 6% · N5 4%</p>
        </div>
      </div>

      {/* ── EXPORT BCEAO ── */}
      <div className="pb-4">
        <h2 className="font-semibold text-white mb-3">Export réglementaire BCEAO</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-sm text-gray-400 mb-4">
            Export horodaté et immuable de toutes les transactions pour la supervision réglementaire BCEAO.
          </p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Export journalier',  desc: 'Toutes les transactions du jour en cours',  href: '/admin/exports?period=day'   },
              { label: 'Export mensuel',     desc: 'Rapport complet du mois sélectionné',       href: '/admin/exports?period=month' },
              { label: 'Export sur période', desc: 'Plage de dates personnalisée',              href: '/admin/exports?period=range' },
            ].map(e => (
              <Link
                key={e.label}
                href={e.href}
                className="flex items-center justify-between border border-gray-700 rounded-xl p-3.5 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-white text-sm">{e.label}</p>
                  <p className="text-xs text-gray-400">{e.desc}</p>
                </div>
                <span className="text-brand-400 text-lg ml-4">↓</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 bg-green-900/20 border border-green-800/30 rounded-xl p-3 text-xs text-green-400">
            📋 Chaque export est signé cryptographiquement et enregistré dans le journal d&apos;audit immuable.
          </div>
        </div>
      </div>

    </div>
  )
}
