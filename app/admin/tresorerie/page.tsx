import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'

export const revalidate = 0

function KpiCard({ label, value, sub, color = 'white', icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: string
}) {
  return (
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${
        color === 'green'  ? 'text-green-400'  :
        color === 'amber'  ? 'text-amber-400'  :
        color === 'red'    ? 'text-red-400'    :
        color === 'purple' ? 'text-purple-400' :
        color === 'blue'   ? 'text-blue-400'   : 'text-white'
      }`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default async function TresoreriePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  // ── Float Mobile Money (depuis float_entries) ──
  const { data: floatRows } = await svc
    .from('float_entries')
    .select('entry_type, amount_fcfa')

  const floatByOp: Record<string, number> = {}
  const OPS = ['mtn_momo', 'moov_money', 'celtiis', 'cash_collected']
  for (const r of floatRows ?? []) {
    if (r.entry_type === 'adjustment_minus') {
      const prev = floatByOp['__adjust'] ?? 0
      floatByOp['__adjust'] = prev - r.amount_fcfa
    } else if (r.entry_type === 'adjustment_plus') {
      const prev = floatByOp['__adjust'] ?? 0
      floatByOp['__adjust'] = prev + r.amount_fcfa
    } else {
      floatByOp[r.entry_type] = (floatByOp[r.entry_type] ?? 0) + r.amount_fcfa
    }
  }
  const totalFloat = Object.values(floatByOp).reduce((s, v) => s + v, 0)

  // ── Revenus plateforme : 45% de chaque commission distribuée ──
  const { data: commDistrib } = await svc
    .from('commission_distributions')
    .select('amount_fcfa, distribution_type')
    .eq('distribution_type', 'platform')

  const platformRevenue = (commDistrib ?? []).reduce((s, r) => s + r.amount_fcfa, 0)

  // ── Cashback total versé ──
  const { data: cashbackDistrib } = await svc
    .from('commission_distributions')
    .select('amount_fcfa')
    .eq('distribution_type', 'cashback')

  const totalCashback = (cashbackDistrib ?? []).reduce((s, r) => s + r.amount_fcfa, 0)

  // ── Réseau total versé ──
  const { data: networkDistrib } = await svc
    .from('commission_distributions')
    .select('amount_fcfa')
    .eq('distribution_type', 'network')

  const totalNetwork = (networkDistrib ?? []).reduce((s, r) => s + r.amount_fcfa, 0)

  // ── Fonds Récompenses/Événements ──
  const { data: rewardsSummary } = await svc
    .from('rewards_fund_summary')
    .select('*')
    .single()

  // ── Spillover ──
  const { data: spilloverSummary } = await svc
    .from('spillover_summary')
    .select('*')
    .single()

  // ── GMV total ──
  const { data: txStats } = await svc
    .from('transactions')
    .select('amount_fcfa, commission_total')
    .eq('status', 'completed')

  const gmvTotal = (txStats ?? []).reduce((s, t) => s + t.amount_fcfa, 0)
  const commissionTotal = (txStats ?? []).reduce((s, t) => s + (t.commission_total ?? 0), 0)
  const nbTransactions = (txStats ?? []).length

  // ── Wallets utilisateurs (solde global) ──
  const { data: walletStats } = await svc
    .from('wallets')
    .select('balance_fcfa, balance_gfp')

  const totalWalletFcfa = (walletStats ?? []).reduce((s, w) => s + (w.balance_fcfa ?? 0), 0)
  const totalWalletGfp  = (walletStats ?? []).reduce((s, w) => s + (w.balance_gfp ?? 0), 0)

  // ── Wallets marchands ──
  const { data: merchantWallets } = await svc
    .from('merchant_wallets')
    .select('balance_fcfa')

  const totalMerchantWallet = (merchantWallets ?? []).reduce((s, w) => s + (w.balance_fcfa ?? 0), 0)

  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo',
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trésorerie consolidée</h1>
          <p className="text-gray-400 text-sm mt-1">Mis à jour : {now} (WAT)</p>
        </div>
      </div>

      {/* Vue d'ensemble */}
      <Section title="Vue d'ensemble — Activité plateforme">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="GMV total" value={formatFcfa(gmvTotal)} sub={`${nbTransactions} transactions`} color="white" icon="💳" />
          <KpiCard label="Commissions perçues" value={formatFcfa(commissionTotal)} sub="Toutes catégories" color="amber" icon="📊" />
          <KpiCard label="Revenu plateforme (45%)" value={formatFcfa(platformRevenue)} color="green" icon="🏦" />
          <KpiCard label="Réseau versé (40%)" value={formatFcfa(totalNetwork)} color="blue" icon="🌐" />
        </div>
      </Section>

      {/* Float Mobile Money */}
      <Section title="Float Mobile Money">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="MTN MoMo" value={formatFcfa(floatByOp['mtn_momo'] ?? 0)} color="amber" icon="📱" />
          <KpiCard label="Moov Money" value={formatFcfa(floatByOp['moov_money'] ?? 0)} color="blue" icon="📱" />
          <KpiCard label="Celtiis" value={formatFcfa(floatByOp['celtiis'] ?? 0)} icon="📱" />
          <KpiCard label="Cash collecté" value={formatFcfa(floatByOp['cash_collected'] ?? 0)} color="amber" icon="💵" />
        </div>
        <div className="mt-3 bg-gray-700 rounded-xl p-4 flex items-center justify-between">
          <span className="text-gray-300 text-sm font-medium">Total float (tous opérateurs)</span>
          <span className="text-white text-xl font-bold">{formatFcfa(totalFloat)}</span>
        </div>
      </Section>

      {/* Wallets */}
      <Section title="Wallets — Engagements envers les utilisateurs">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Wallets utilisateurs (FCFA)" value={formatFcfa(totalWalletFcfa)} sub="Soldes à restituer" color="red" icon="👛" />
          <KpiCard label="Wallets utilisateurs (GFP)" value={totalWalletGfp.toLocaleString('fr-FR') + ' GFP'} sub={`≈ ${formatFcfa(Math.floor(totalWalletGfp / 10))}`} icon="⭐" />
          <KpiCard label="Wallets marchands" value={formatFcfa(totalMerchantWallet)} sub="À décaisser sur demande" color="red" icon="🏪" />
        </div>
        <div className="mt-3 bg-gray-700 rounded-xl p-4 flex items-center justify-between">
          <span className="text-gray-300 text-sm font-medium">Cashback total versé aux acheteurs</span>
          <span className="text-white text-lg font-bold">{formatFcfa(totalCashback)}</span>
        </div>
      </Section>

      {/* Fonds dédiés */}
      <Section title="Fonds dédiés">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide">Fonds Récompenses / Événements</span>
              <span className="text-xl">🎁</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{formatFcfa(rewardsSummary?.total_fonds ?? 0)}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Pool récompenses (30%)</div>
                <div className="text-purple-300 font-medium">{formatFcfa(rewardsSummary?.total_pool_recompenses ?? 0)}</div>
                <div className="text-gray-500 text-xs mt-0.5">Distribué : {formatFcfa(rewardsSummary?.total_distribue_recompenses ?? 0)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Pool événements (70%)</div>
                <div className="text-purple-300 font-medium">{formatFcfa(rewardsSummary?.total_pool_evenements ?? 0)}</div>
                <div className="text-gray-500 text-xs mt-0.5">Distribué : {formatFcfa(rewardsSummary?.total_distribue_evenements ?? 0)}</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs uppercase tracking-wide">Spillover cumulé</span>
              <span className="text-xl">↩️</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{formatFcfa(spilloverSummary?.total_spillover_fcfa ?? 0)}</div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Niveaux orphelins</span>
                <span className="text-amber-300">{formatFcfa(spilloverSummary?.orphan_fcfa ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Kingmakers inactifs</span>
                <span className="text-amber-300">{formatFcfa(spilloverSummary?.inactive_fcfa ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Arrondis</span>
                <span className="text-gray-400">{formatFcfa(spilloverSummary?.rounding_fcfa ?? 0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-700">
                <span className="text-gray-300 text-xs font-medium">Transactions concernées</span>
                <span className="text-white">{spilloverSummary?.nb_transactions ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
