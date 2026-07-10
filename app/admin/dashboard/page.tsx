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

      {/* ── RAPPORT IA QUOTIDIEN ── */}
      <DigestCard digest={latestDigest as Parameters<typeof DigestCard>[0]['digest']} />

      {/* ── ALERTE GOUVERNANCE ── */}
      {auditLogs.length > 0 && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4">
          <p className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-2">
            🚨 {auditLogs.length} tentative(s) de modification des constantes de gouvernance
          </p>
          <div className="space-y-1">
            {auditLogs.slice(0, 3).map((log: { id: string; field_attempted: string; attempted_value: string; was_blocked: boolean; created_at: string }) => (
              <p key={log.id} className="text-red-300 text-xs">
                <span className="font-mono">{log.field_attempted}</span>
                {' '}→ valeur tentée : {log.attempted_value}
                {' '}· {new Date(log.created_at).toLocaleString('fr-FR')}
                {log.was_blocked && <span className="ml-2 bg-red-500/30 text-red-300 px-1.5 rounded text-[10px]">BLOQUÉ</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs AUJOURD'HUI ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Aujourd&apos;hui</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "GMV aujourd'hui",         value: `${formatFcfa(gmvToday)} F`,    delta: 'Volume encaissé',                  icon: '💰', color: 'text-green-400',  href: '/admin/transactions' },
            { label: "Revenu plateforme (45%)", value: `${formatFcfa(Math.floor(commToday * 0.45))} F`, delta: '45% des commissions', icon: '📊', color: 'text-brand-400', href: '/admin/transactions' },
            { label: 'Transactions complétées', value: String(txToday),                delta: 'transactions validées',            icon: '💳', color: 'text-white',        href: '/admin/transactions' },
            { label: 'Alertes gouvernance',     value: String(auditLogs.length),        delta: auditLogs.length > 0 ? 'À traiter' : 'RAS', icon: '🛡️', color: auditLogs.length > 0 ? 'text-red-400' : 'text-green-400', href: '/admin/transactions' },
          ].map(s => (
            <Link key={s.label} href={s.href} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors block">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{s.icon}</span>
                <p className="text-gray-400 text-xs leading-tight">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.delta}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MEMBRES + MARCHANDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Membres total',     value: totalUsers.toLocaleString('fr-FR'),  icon: '👥', color: 'text-white',        href: '/admin/users'        },
          { label: 'Marchands actifs',  value: activeMerch.toLocaleString('fr-FR'), icon: '🏪', color: 'text-white',        href: '/admin/merchants'    },
          { label: 'Membres invités',   value: networkSize.toLocaleString('fr-FR'), icon: '🌱', color: 'text-brand-400',    href: '/admin/users'        },
          { label: 'Retraits en attente', value: String(pendingWd), icon: '⏳', color: pendingWd > 0 ? 'text-yellow-400' : 'text-gray-400', href: '/admin/withdrawals' },
        ].map(s => (
          <Link key={s.label} href={s.href} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors block">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">{s.icon}</span>
              <p className="text-gray-400 text-xs">{s.label}</p>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      {/* ── RÉPARTITION DES COMMISSIONS (mois) ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
          Répartition des commissions — {now.toLocaleString('fr-FR', { month: 'long' })}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">GMV ce mois</p>
            <p className="text-2xl font-bold text-white">{formatFcfa(gmvMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">FCFA</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Revenu plateforme (45%)</p>
            <p className="text-2xl font-bold text-brand-400">{formatFcfa(platformMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">GreenFlame</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Cashback acheteurs (12%)</p>
            <p className="text-2xl font-bold text-blue-400">{formatFcfa(cashbackMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">Crédité aux acheteurs</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Pool Récompenses (3%)</p>
            <p className="text-2xl font-bold text-amber-400">{formatFcfa(rewardsMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">30% récomp. / 70% événements</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Dividendes communauté (40%)</p>
            <p className="text-2xl font-bold text-green-400">{formatFcfa(networkMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {spilloverMonth > 0 ? `FlameFund : ${formatFcfa(spilloverMonth)} F` : 'N1→N5'}
            </p>
          </div>
        </div>
      </div>

      {/* ── REVENUS GREENFLAME ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Revenus GreenFlame (total cumulé)</p>
          <Link href="/admin/revenue" className="text-xs text-brand-400 hover:text-brand-300">
            Détail →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-brand-900/40 rounded-xl p-5 border border-brand-800/50">
            <p className="text-gray-400 text-xs mb-1">Total GreenFlame</p>
            <p className="text-2xl font-bold text-brand-300">{formatFcfa(totalGFRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">FCFA cumulés</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Frais transactions (45%)</p>
            <p className="text-xl font-bold text-brand-400">{formatFcfa(platformMonth)}</p>
            <p className="text-xs text-gray-500 mt-1">Ce mois-ci</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Abonnements (Pro + VIP)</p>
            <p className="text-xl font-bold text-purple-400">{formatFcfa(subsRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {proCount} Pro · {vipCount} VIP actifs
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">Frais bons de retrait (0,5%)</p>
            <p className="text-xl font-bold text-amber-400">{formatFcfa(voucherRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur tous les bons encaissés</p>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS RÉCENTES ── */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-white">Transactions récentes</h2>
          <Link href="/admin/transactions" className="text-xs text-brand-400 hover:text-brand-300">
            Tout voir →
          </Link>
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
                    <td className="px-4 py-3 font-medium text-white">
                      {tx.merchants?.business_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {tx.buyers?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white">
                      {formatFcfa(tx.amount_fcfa)} F
                    </td>
                    <td className="px-4 py-3 text-right text-brand-400 font-medium">
                      +{formatFcfa(tx.commission_total)} F
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tx.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                        tx.status === 'failed'    ? 'bg-red-900/30 text-red-400'     :
                                                   'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {tx.status === 'completed' ? '✓ OK' : tx.status === 'failed' ? '✗ Échec' : '⏳'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SANTÉ DE LA COMMUNAUTÉ ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="font-semibold text-white mb-4">Santé de la communauté</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-400 text-xs">Membres totaux</p>
            <p className="text-2xl font-bold text-white mt-1">{totalUsers.toLocaleString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Membres avec invitation</p>
            <p className="text-2xl font-bold text-brand-400 mt-1">{networkSize.toLocaleString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">FlameFund ce mois</p>
            <p className={`text-2xl font-bold mt-1 ${spilloverMonth > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {formatFcfa(spilloverMonth)} F
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">FlameFund total cumulé</p>
            <p className={`text-2xl font-bold mt-1 ${spilloverTotal > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
              {formatFcfa(spilloverTotal)} F
            </p>
          </div>
        </div>
      </div>

      {/* ── CONSTANTES DE GOUVERNANCE ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="font-semibold text-white mb-1">Constantes de gouvernance</h2>
        <p className="text-xs text-gray-500 mb-4">Immuables — toute tentative de modification est bloquée et loggée</p>
        <div className="space-y-3">
          {[
            { label: 'GreenFlame (plateforme)', pct: '45%', color: 'bg-brand-500' },
            { label: 'Cashback acheteur',       pct: '12%', color: 'bg-blue-500'  },
            { label: 'Communauté (5 niveaux)',  pct: '40%', color: 'bg-green-500' },
            { label: 'Pool Récompenses',        pct: '3%',  color: 'bg-amber-500' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color}`} />
              <span className="text-gray-300 flex-1 text-sm">{item.label}</span>
              <span className="font-bold text-white">{item.pct}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">
            Communauté : N1 12% · N2 10% · N3 8% · N4 6% · N5 4%
          </p>
        </div>
      </div>

      {/* ── EXPORT BCEAO ── */}
      <div>
        <h2 className="font-semibold text-white mb-3">Export réglementaire BCEAO</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-sm text-gray-400 mb-5">
            Génère un export horodaté et immuable de toutes les transactions pour la supervision réglementaire.
            Conforme aux exigences de la BCEAO pour les plateformes de paiement numérique.
          </p>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Export journalier',    desc: 'Toutes les transactions du jour en cours',    href: '/admin/exports?period=day'   },
              { label: 'Export mensuel',       desc: 'Rapport complet du mois sélectionné',         href: '/admin/exports?period=month' },
              { label: 'Export sur période',   desc: 'Sélectionner une plage de dates personnalisée', href: '/admin/exports?period=range' },
            ].map(e => (
              <Link
                key={e.label}
                href={e.href}
                className="flex items-center justify-between border border-gray-700 rounded-xl p-4 hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-white text-sm">{e.label}</p>
                  <p className="text-xs text-gray-400">{e.desc}</p>
                </div>
                <span className="text-brand-400 text-lg ml-4">↓</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 bg-green-900/20 border border-green-800/30 rounded-xl p-3 text-xs text-green-400">
            📋 Chaque export est signé cryptographiquement et enregistré dans le journal d&apos;audit immuable.
          </div>
        </div>
      </div>

      {/* ── LIENS RAPIDES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4">
        {[
          { href: '/admin/merchants',    label: 'Marchands',    icon: '🏪' },
          { href: '/admin/users',        label: 'Membres',      icon: '👥' },
          { href: '/admin/transactions', label: 'Transactions', icon: '💳' },
          { href: '/admin/withdrawals',  label: 'Retraits',     icon: '💸' },
          { href: '/admin/flamme',       label: 'Flamme + Rang', icon: '🔥' },
        ].map(l => (
          <Link key={l.href} href={l.href}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center hover:border-brand-500/50 hover:bg-gray-700/30 transition-colors cursor-pointer">
              <span className="text-2xl">{l.icon}</span>
              <p className="text-xs font-medium text-gray-300 mt-2">{l.label}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
