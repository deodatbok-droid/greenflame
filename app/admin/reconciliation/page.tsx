import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CashPendingPanel, { type CashPendingItem } from './CashPendingPanel'
import FloatEntryForm from './FloatEntryForm'

export const revalidate = 0

// ── Types ─────────────────────────────────────────────────────────────

interface FloatEntryRow {
  id: string
  entry_type: string
  amount_fcfa: number
  operator_ref: string | null
  merchant_id: string | null
  merchant_name: string | null
  notes: string | null
  entry_date: string
  recorder_name: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────

const ENTRY_LABELS: Record<string, string> = {
  cash_collected:   '💵 Cash collecté',
  mtn_momo:         '📱 MTN MoMo',
  moov_money:       '📱 Moov Money',
  celtiis:          '📱 Celtiis',
  adjustment_plus:  '➕ Ajustement +',
  adjustment_minus: '➖ Ajustement −',
}

const ENTRY_COLORS: Record<string, string> = {
  cash_collected:   'bg-amber-900/30 text-amber-300',
  mtn_momo:         'bg-yellow-900/30 text-yellow-300',
  moov_money:       'bg-blue-900/30 text-blue-300',
  celtiis:          'bg-purple-900/30 text-purple-300',
  adjustment_plus:  'bg-green-900/30 text-green-300',
  adjustment_minus: 'bg-red-900/30 text-red-300',
}

function KpiCard({ label, value, sub, color = 'white', alert = false, tip }: {
  label: string; value: string; sub?: string; color?: string; alert?: boolean; tip?: string
}) {
  return (
    <div className={`bg-gray-800 rounded-2xl p-5 border ${alert ? 'border-red-500/60' : 'border-gray-700'}`} title={tip}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${
        color === 'green' ? 'text-green-400' :
        color === 'red'   ? 'text-red-400'   :
        color === 'amber' ? 'text-amber-400' :
        color === 'brand' ? 'text-brand-400' : 'text-white'
      }`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
      ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
      {label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function ReconciliationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Toutes les requêtes en parallèle ─────────────────────────────
  const [
    userWalletRes,
    merchantWalletRes,
    todayTxRes,
    weekTxRes,
    monthTxRes,
    pendingTxRes,
    pendingWithdrawalsRes,
    userCountRes,
    todaySignupsRes,
    monthSignupsRes,
    merchantCountRes,
    floatEntriesRes,
    monthFloatRes,
    uncollectedCashRes,
    activeMerchantsRes,
    agentCashinTodayRes,
    agentCashinMonthRes,
    agentCashinDebitRes,
    agentDepositOutRes,
    cashCollectedEntriesRes,
  ] = await Promise.all([
    svc.from('wallets').select('balance_fcfa, balance_gfp'),
    svc.from('merchant_wallets').select('balance_fcfa'),
    svc.from('transactions').select('amount_fcfa, commission_total, payment_method')
       .gte('created_at', startOfDay.toISOString()).eq('status', 'completed'),
    svc.from('transactions').select('amount_fcfa, commission_total')
       .gte('created_at', startOfWeek.toISOString()).eq('status', 'completed'),
    svc.from('transactions').select('amount_fcfa, commission_total')
       .gte('created_at', startOfMonth.toISOString()).eq('status', 'completed'),
    svc.from('transactions').select('id, amount_fcfa, payment_method, created_at')
       .in('status', ['pending', 'processing'])
       .order('created_at', { ascending: false }).limit(10),
    svc.from('withdrawal_requests').select('id, amount_fcfa, operator, phone, currency_type, created_at')
       .eq('status', 'pending').order('created_at', { ascending: true }),
    svc.from('users').select('id', { count: 'exact', head: true }),
    svc.from('users').select('id', { count: 'exact', head: true }).gte('created_at', startOfDay.toISOString()),
    svc.from('users').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
    svc.from('merchants').select('id', { count: 'exact', head: true }).eq('is_active', true),
    // Float entries — 50 dernières
    svc.from('float_entries')
       .select('id, entry_type, amount_fcfa, operator_ref, merchant_id, notes, entry_date, recorded_by, created_at')
       .order('created_at', { ascending: false }).limit(50),
    // Résumé float ce mois
    svc.from('float_entries').select('entry_type, amount_fcfa')
       .gte('entry_date', startOfMonth.toISOString().slice(0, 10)),
    // Cash non collecté
    svc.from('transactions')
       .select('merchant_id, amount_fcfa, created_at')
       .eq('payment_method', 'cash_confirmed')
       .eq('status', 'completed')
       .eq('float_collected', false),
    // Marchands actifs pour le formulaire
    svc.from('merchants').select('id, business_name').eq('is_active', true).order('business_name'),
    // Agent cash-in aujourd'hui (crédits = une entrée par opération)
    svc.from('wallet_ledger')
      .select('amount, wallet_id')
      .eq('transaction_type', 'agent_cashin_credit')
      .gte('created_at', startOfDay.toISOString()),
    // Agent cash-in ce mois
    svc.from('wallet_ledger')
      .select('amount, wallet_id')
      .eq('transaction_type', 'agent_cashin_credit')
      .gte('created_at', startOfMonth.toISOString()),
    // Agent cash-in — débits wallet perso de l'agent (flux /merchant/cashin → /api/wallets/agent-cashin)
    svc.from('wallet_ledger')
      .select('amount, wallet_id, created_at')
      .eq('transaction_type', 'agent_cashin_debit'),
    // Agent cash-in — débits wallet boutique de l'agent (flux /merchant/agent → /api/agent/deposit)
    svc.from('merchant_wallet_ledger')
      .select('amount, merchant_wallet_id, created_at')
      .eq('transaction_type', 'agent_deposit_out'),
    // Collectes déjà enregistrées par marchand (pour ne pas re-compter le cash déjà récupéré)
    svc.from('float_entries')
      .select('merchant_id, entry_date')
      .eq('entry_type', 'cash_collected')
      .not('merchant_id', 'is', null),
  ])

  // ── Wallets ───────────────────────────────────────────────────────
  const totalUserFcfa    = (userWalletRes.data    ?? []).reduce((s, w) => s + (w.balance_fcfa ?? 0), 0)
  const totalUserGfp     = (userWalletRes.data    ?? []).reduce((s, w) => s + (w.balance_gfp  ?? 0), 0)
  const totalMerchantFcfa= (merchantWalletRes.data ?? []).reduce((s, w) => s + (w.balance_fcfa ?? 0), 0)
  const totalFloat       = totalUserFcfa + totalMerchantFcfa
  const userWalletCount  = (userWalletRes.data    ?? []).length
  const merchantWalletCount = (merchantWalletRes.data ?? []).length

  // ── Transactions ─────────────────────────────────────────────────
  const todayTxs    = todayTxRes.data    ?? []
  const weekTxs     = weekTxRes.data     ?? []
  const monthTxs    = monthTxRes.data    ?? []
  const pendingTxs  = pendingTxRes.data  ?? []
  const pendingWithdrawals = pendingWithdrawalsRes.data ?? []

  const todayGmv        = todayTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const todayCommission = todayTxs.reduce((s, t) => s + t.commission_total, 0)
  const todayDigital    = todayTxs.filter(t => t.payment_method !== 'cash_confirmed').reduce((s, t) => s + t.amount_fcfa, 0)
  const todayCash       = todayTxs.filter(t => t.payment_method === 'cash_confirmed').reduce((s, t) => s + t.amount_fcfa, 0)
  const weekGmv         = weekTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const monthGmv        = monthTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const monthCommission = monthTxs.reduce((s, t) => s + t.commission_total, 0)
  const monthPlatformRevenue = Math.floor(monthCommission * 0.45)
  const totalPendingWithdrawal = pendingWithdrawals.reduce((s, w) => s + w.amount_fcfa, 0)

  // ── Float entries ────────────────────────────────────────────────
  const rawEntries = floatEntriesRes.data ?? []
  const monthlyEntries = monthFloatRes.data ?? []

  // Résumé par type (ce mois)
  const floatByType: Record<string, number> = {}
  let totalFloatDeclaredMonth = 0
  for (const e of monthlyEntries) {
    floatByType[e.entry_type] = (floatByType[e.entry_type] ?? 0) + e.amount_fcfa
    totalFloatDeclaredMonth += e.entry_type === 'adjustment_minus' ? -e.amount_fcfa : e.amount_fcfa
  }

  // Enrichir les entrées avec les noms
  const entryMerchantIds = [...new Set(rawEntries.map(e => e.merchant_id).filter(Boolean) as string[])]
  const entryRecorderIds = [...new Set(rawEntries.map(e => e.recorded_by).filter(Boolean) as string[])]

  const [entryMerchantsRes, entryRecordersRes] = await Promise.all([
    entryMerchantIds.length > 0
      ? svc.from('merchants').select('id, business_name').in('id', entryMerchantIds)
      : Promise.resolve({ data: [] }),
    entryRecorderIds.length > 0
      ? svc.from('users').select('id, full_name').in('id', entryRecorderIds)
      : Promise.resolve({ data: [] }),
  ])

  const entryMerchantMap = Object.fromEntries((entryMerchantsRes.data ?? []).map(m => [m.id, m.business_name]))
  const entryRecorderMap = Object.fromEntries((entryRecordersRes.data ?? []).map(u => [u.id, u.full_name]))

  const floatEntries: FloatEntryRow[] = rawEntries.map(e => ({
    id:            e.id,
    entry_type:    e.entry_type,
    amount_fcfa:   e.amount_fcfa,
    operator_ref:  e.operator_ref,
    merchant_id:   e.merchant_id,
    merchant_name: e.merchant_id ? (entryMerchantMap[e.merchant_id] ?? null) : null,
    notes:         e.notes,
    entry_date:    e.entry_date,
    recorder_name: entryRecorderMap[e.recorded_by] ?? null,
    created_at:    e.created_at,
  }))

  // ── Cash non collecté — groupé par marchand ──────────────────────
  const uncollectedRaw = uncollectedCashRes.data ?? []

  // Résoudre les noms des marchands concernés
  const uncollectedMerchantIds = [...new Set(uncollectedRaw.map(t => t.merchant_id).filter(Boolean) as string[])]
  const { data: uncollectedMerchantsData } = uncollectedMerchantIds.length > 0
    ? await svc.from('merchants').select('id, business_name').in('id', uncollectedMerchantIds)
    : { data: [] }

  const uncollectedMerchantMap = Object.fromEntries(
    (uncollectedMerchantsData ?? []).map(m => [m.id, m.business_name])
  )

  const cashByMerchant: Record<string, CashPendingItem> = {}
  for (const tx of uncollectedRaw) {
    if (!cashByMerchant[tx.merchant_id]) {
      cashByMerchant[tx.merchant_id] = {
        merchant_id:   tx.merchant_id,
        business_name: uncollectedMerchantMap[tx.merchant_id] ?? 'Marchand inconnu',
        total_fcfa:    0,
        tx_count:      0,
        oldest_tx:     tx.created_at,
      }
    }
    cashByMerchant[tx.merchant_id].total_fcfa += tx.amount_fcfa
    cashByMerchant[tx.merchant_id].tx_count  += 1
    if (tx.created_at < cashByMerchant[tx.merchant_id].oldest_tx) {
      cashByMerchant[tx.merchant_id].oldest_tx = tx.created_at
    }
  }

  const cashPendingList = Object.values(cashByMerchant).sort((a, b) => b.total_fcfa - a.total_fcfa)
  const totalCashPending = cashPendingList.reduce((s, m) => s + m.total_fcfa, 0)

  // ── Agent cash-in — exposition par agent (cash décaissé en attente de collecte) ──
  // Deux flux existent en parallèle dans le produit :
  //  1) /merchant/cashin → /api/wallets/agent-cashin : débite le wallet PERSO de l'agent (wallet_ledger.agent_cashin_debit)
  //  2) /merchant/agent  → /api/agent/deposit         : débite le wallet BOUTIQUE de l'agent (merchant_wallet_ledger.agent_deposit_out)
  // Les deux représentent du cash physique que l'agent détient désormais et que GreenFlame doit récupérer.
  const agentDebitRaw    = agentCashinDebitRes.data    ?? []
  const agentDepositRaw  = agentDepositOutRes.data     ?? []
  const cashCollectedRaw = cashCollectedEntriesRes.data ?? []

  // Dernière collecte connue par marchand — tout ce qui est antérieur est considéré comme récupéré
  const lastCollectedByMerchant: Record<string, string> = {}
  for (const c of cashCollectedRaw) {
    if (!c.merchant_id) continue
    if (!lastCollectedByMerchant[c.merchant_id] || c.entry_date > lastCollectedByMerchant[c.merchant_id]) {
      lastCollectedByMerchant[c.merchant_id] = c.entry_date
    }
  }

  // Résoudre wallet_id (wallet perso) → marchand, pour le flux agent-cashin
  const debitWalletIds = [...new Set(agentDebitRaw.map(d => d.wallet_id))]
  const { data: debitWalletsData } = debitWalletIds.length > 0
    ? await svc.from('wallets').select('id, user_id').in('id', debitWalletIds)
    : { data: [] as { id: string; user_id: string }[] }
  const debitWalletUserIds = [...new Set((debitWalletsData ?? []).map(w => w.user_id))]
  const { data: debitMerchantsData } = debitWalletUserIds.length > 0
    ? await svc.from('merchants').select('id, user_id, business_name').in('user_id', debitWalletUserIds)
    : { data: [] as { id: string; user_id: string; business_name: string }[] }
  const walletIdToMerchant: Record<string, { id: string; business_name: string }> = {}
  for (const w of (debitWalletsData ?? [])) {
    const m = (debitMerchantsData ?? []).find(mm => mm.user_id === w.user_id)
    if (m) walletIdToMerchant[w.id] = { id: m.id, business_name: m.business_name }
  }

  // Résoudre merchant_wallet_id (wallet boutique) → marchand, pour le flux agent/deposit
  const depositWalletIds = [...new Set(agentDepositRaw.map(d => d.merchant_wallet_id))]
  const { data: depositWalletsData } = depositWalletIds.length > 0
    ? await svc.from('merchant_wallets').select('id, merchant_id').in('id', depositWalletIds)
    : { data: [] as { id: string; merchant_id: string }[] }
  const depositMerchantIds = [...new Set((depositWalletsData ?? []).map(w => w.merchant_id))]
  const { data: depositMerchantsData } = depositMerchantIds.length > 0
    ? await svc.from('merchants').select('id, business_name').in('id', depositMerchantIds)
    : { data: [] as { id: string; business_name: string }[] }
  const depositMerchantNameMap = Object.fromEntries((depositMerchantsData ?? []).map(m => [m.id, m.business_name]))
  const merchantWalletIdToMerchant: Record<string, { id: string; business_name: string }> = {}
  for (const w of (depositWalletsData ?? [])) {
    merchantWalletIdToMerchant[w.id] = { id: w.merchant_id, business_name: depositMerchantNameMap[w.merchant_id] ?? 'Agent inconnu' }
  }

  const agentExposure: Record<string, CashPendingItem> = {}
  function addAgentExposure(merchantId: string, businessName: string, amount: number, createdAt: string) {
    const lastCollected = lastCollectedByMerchant[merchantId]
    if (lastCollected && createdAt.slice(0, 10) <= lastCollected) return
    if (!agentExposure[merchantId]) {
      agentExposure[merchantId] = { merchant_id: merchantId, business_name: businessName, total_fcfa: 0, tx_count: 0, oldest_tx: createdAt }
    }
    agentExposure[merchantId].total_fcfa += amount
    agentExposure[merchantId].tx_count += 1
    if (createdAt < agentExposure[merchantId].oldest_tx) agentExposure[merchantId].oldest_tx = createdAt
  }
  for (const d of agentDebitRaw) {
    const m = walletIdToMerchant[d.wallet_id]
    if (m) addAgentExposure(m.id, m.business_name, d.amount, d.created_at)
  }
  for (const d of agentDepositRaw) {
    const m = merchantWalletIdToMerchant[d.merchant_wallet_id]
    if (m) addAgentExposure(m.id, m.business_name, d.amount, d.created_at)
  }

  const agentCashinPendingList = Object.values(agentExposure).sort((a, b) => b.total_fcfa - a.total_fcfa)
  const totalAgentCashinPending = agentCashinPendingList.reduce((s, m) => s + m.total_fcfa, 0)

  // ── Alertes ──────────────────────────────────────────────────────
  const alerts: { level: 'warning' | 'critical'; message: string }[] = []

  if (cashPendingList.length > 0) {
    alerts.push({
      level: totalCashPending > 200_000 ? 'critical' : 'warning',
      message: `${formatFcfa(totalCashPending)} FCFA en espèces chez ${cashPendingList.length} marchand(s) — non encore collecté`
    })
  }
  if (totalAgentCashinPending > 100_000) {
    alerts.push({
      level: totalAgentCashinPending > 200_000 ? 'critical' : 'warning',
      message: `${formatFcfa(totalAgentCashinPending)} FCFA en cash chez ${agentCashinPendingList.length} agent(s) cash-in — à récupérer`
    })
  }
  if (pendingTxs.length > 5) {
    alerts.push({ level: 'warning', message: `${pendingTxs.length} transactions en attente depuis plus de 5 minutes` })
  }
  if (totalPendingWithdrawal > 500_000) {
    alerts.push({ level: 'warning', message: `${formatFcfa(totalPendingWithdrawal)} FCFA de retraits en attente de traitement` })
  }
  if (pendingWithdrawals.some(w => {
    const age = (now.getTime() - new Date(w.created_at).getTime()) / 3_600_000
    return age > 24
  })) {
    alerts.push({ level: 'critical', message: 'Un ou plusieurs retraits ont plus de 24h sans traitement' })
  }

  const allOk = alerts.length === 0
  const activeMerchants = activeMerchantsRes.data ?? []

  // ── Agent cash-in ────────────────────────────────────────────────
  const agentCashinToday = agentCashinTodayRes.data ?? []
  const agentCashinMonth = agentCashinMonthRes.data ?? []
  // Flux A (/merchant/cashin → wallet_ledger.agent_cashin_credit)
  const agentCashinTodayVolumeA = agentCashinToday.reduce((s, e) => s + e.amount, 0)
  const agentCashinMonthVolumeA = agentCashinMonth.reduce((s, e) => s + e.amount, 0)
  const agentCashinTodayCountA  = agentCashinToday.length
  const agentCashinMonthCountA  = agentCashinMonth.length

  // Flux B (/merchant/agent → merchant_wallet_ledger.agent_deposit_out) — filtré côté client
  const agentDepositAll         = agentDepositOutRes.data ?? []
  const agentDepositToday       = agentDepositAll.filter(e => e.created_at >= startOfDay.toISOString())
  const agentDepositMonth       = agentDepositAll.filter(e => e.created_at >= startOfMonth.toISOString())
  const agentCashinTodayVolumeB = agentDepositToday.reduce((s, e) => s + e.amount, 0)
  const agentCashinMonthVolumeB = agentDepositMonth.reduce((s, e) => s + e.amount, 0)

  // Totaux combinés Flux A + Flux B
  const agentCashinTodayVolume = agentCashinTodayVolumeA + agentCashinTodayVolumeB
  const agentCashinMonthVolume = agentCashinMonthVolumeA + agentCashinMonthVolumeB
  const agentCashinTodayCount  = agentCashinTodayCountA  + agentDepositToday.length
  const agentCashinMonthCount  = agentCashinMonthCountA  + agentDepositMonth.length

  return (
    <div className="max-w-5xl space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Réconciliation</span>
      </div>

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Float & Réconciliation</h1>
          <p className="text-gray-400 text-sm mt-1">
            Actualisé le {now.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })} à{' '}
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <StatusBadge ok={allOk} label={allOk ? 'Float équilibré' : `${alerts.length} alerte(s)`} />
      </div>

      {/* ── Alertes ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ${
              a.level === 'critical'
                ? 'bg-red-900/40 border border-red-500/60 text-red-300'
                : 'bg-amber-900/40 border border-amber-500/60 text-amber-300'
            }`}>
              <span>{a.level === 'critical' ? '🚨' : '⚠️'}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Float — vue consolidée ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Float GreenFlame — en temps réel</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Float théorique total"
            value={formatFcfa(totalFloat) + ' FCFA'}
            sub="Wallets users + boutiques"
            color="amber"
            tip="Ce que GreenFlame doit être en mesure de décaisser à tout moment"
          />
          <KpiCard
            label="Wallets utilisateurs"
            value={formatFcfa(totalUserFcfa) + ' FCFA'}
            sub={`${userWalletCount} comptes · ${totalUserGfp.toLocaleString('fr-FR')} GFP`}
          />
          <KpiCard
            label="Wallets boutiques"
            value={formatFcfa(totalMerchantFcfa) + ' FCFA'}
            sub={`${merchantWalletCount} marchands`}
          />
          <KpiCard
            label="Cash chez marchands"
            value={formatFcfa(totalCashPending) + ' FCFA'}
            sub={totalCashPending > 0 ? `${cashPendingList.length} marchand(s) — à collecter` : 'Rien à collecter ✓'}
            color={totalCashPending > 0 ? 'red' : 'green'}
            alert={totalCashPending > 100_000}
            tip="Paiements en espèces confirmés mais pas encore physiquement collectés par GreenFlame"
          />
        </div>
      </div>

      {/* ── Encaissements déclarés ce mois ── */}
      {Object.keys(floatByType).length > 0 && (
        <div>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Encaissements déclarés — ce mois</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['cash_collected', 'mtn_momo', 'moov_money', 'celtiis'] as const).map(type => (
              <KpiCard
                key={type}
                label={ENTRY_LABELS[type] ?? type}
                value={formatFcfa(floatByType[type] ?? 0) + ' FCFA'}
                sub={(floatByType[type] ?? 0) === 0 ? 'Aucun' : undefined}
                color={(floatByType[type] ?? 0) > 0 ? 'green' : 'white'}
              />
            ))}
          </div>
          {(floatByType['adjustment_plus'] || floatByType['adjustment_minus']) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {floatByType['adjustment_plus'] && (
                <KpiCard label="Ajustements +" value={formatFcfa(floatByType['adjustment_plus']) + ' FCFA'} color="green" />
              )}
              {floatByType['adjustment_minus'] && (
                <KpiCard label="Ajustements −" value={formatFcfa(floatByType['adjustment_minus']) + ' FCFA'} color="red" />
              )}
            </div>
          )}
          <div className="mt-3 bg-brand-900/20 border border-brand-700/30 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-brand-300 text-sm font-medium">Total encaissé déclaré ce mois</p>
            <p className="text-brand-300 text-xl font-bold">{formatFcfa(totalFloatDeclaredMonth)} FCFA</p>
          </div>
        </div>
      )}

      {/* ── Cash chez les marchands (interactif) ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Argent chez les marchands</h2>
        <CashPendingPanel items={cashPendingList} />
      </div>

      {/* ── Saisir un encaissement ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Déclarer un encaissement</h2>
        <FloatEntryForm merchants={activeMerchants} />
      </div>

      {/* ── Activité du jour ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Activité — aujourd&apos;hui ({today})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="GMV du jour"         value={formatFcfa(todayGmv) + ' FCFA'}        sub={`${todayTxs.length} transaction(s)`} color="green" />
          <KpiCard label="Commission du jour"  value={formatFcfa(todayCommission) + ' FCFA'} sub="Tous opérateurs" />
          <KpiCard label="Digital (Momo+GF)"   value={formatFcfa(todayDigital) + ' FCFA'}    sub="Momo + wallet GreenFlame" />
          <KpiCard label="Cash du jour"        value={formatFcfa(todayCash) + ' FCFA'}       sub="Cash confirmé par marchands" color="amber" />
        </div>
      </div>

      {/* ── Agent cash-in ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Service Agent — cash-in</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Volume aujourd'hui"
            value={formatFcfa(agentCashinTodayVolume) + ' FCFA'}
            sub={agentCashinTodayCount > 0 ? `${agentCashinTodayCount} opération(s)` : 'Aucune opération'}
            color={agentCashinTodayCount > 0 ? 'green' : 'white'}
            tip="Total des montants déposés sur wallets clients via agents aujourd'hui"
          />
          <KpiCard
            label="Volume ce mois"
            value={formatFcfa(agentCashinMonthVolume) + ' FCFA'}
            sub={`${agentCashinMonthCount} opération(s)`}
            color={agentCashinMonthCount > 0 ? 'brand' : 'white'}
          />
          <KpiCard
            label="Moy. / opération"
            value={agentCashinMonthCount > 0
              ? formatFcfa(Math.floor(agentCashinMonthVolume / agentCashinMonthCount)) + ' FCFA'
              : '—'}
            sub="Ce mois-ci"
          />
          <KpiCard
            label="Float redistribué"
            value={formatFcfa(agentCashinMonthVolume) + ' FCFA'}
            sub="Wallet marchand → wallet client"
            color={agentCashinMonthVolume > 0 ? 'amber' : 'white'}
            tip="Montant total sorti des wallets marchands-agents vers des clients ce mois"
          />
        </div>
        {agentCashinMonthCount === 0 && (
          <p className="mt-2 text-gray-600 text-xs">Aucune opération de cash-in agent ce mois — service actif mais non utilisé ou service non activé.</p>
        )}
      </div>

      {/* ── Cash chez les agents (par agent, en attente de collecte) ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
          Service Agent — exposition par agent
        </h2>
        <CashPendingPanel
          items={agentCashinPendingList}
          title="📲 Cash chez les agents cash-in — à récupérer"
          subtitle="Cash déjà décaissé par les agents à leurs clients, pas encore physiquement collecté par GreenFlame"
          emptyTitle="Aucune exposition agent en attente"
          emptyMessage="Tout le cash-in agent est couvert par une collecte récente"
        />
      </div>

      {/* ── Performance mensuelle ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Performance — ce mois-ci</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="GMV mensuel"            value={formatFcfa(monthGmv) + ' FCFA'}             sub={`${monthTxs.length} transactions`} color="green" />
          <KpiCard label="GMV hebdo (7j)"         value={formatFcfa(weekGmv) + ' FCFA'}              sub={`${weekTxs.length} transactions`} />
          <KpiCard label="Revenus GreenFlame"     value={formatFcfa(monthPlatformRevenue) + ' FCFA'} sub="45% des commissions" color="brand" />
          <KpiCard label="Commissions totales"    value={formatFcfa(monthCommission) + ' FCFA'}      sub="Tous niveaux confondus" />
        </div>
      </div>

      {/* ── Retraits en attente ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 md:col-span-1">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Retraits en attente</p>
          <p className={`text-2xl font-bold ${pendingWithdrawals.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {formatFcfa(totalPendingWithdrawal)} FCFA
          </p>
          <p className="text-gray-500 text-xs mt-1">{pendingWithdrawals.length} demande(s) à traiter</p>
        </div>
      </div>

      {/* ── Communauté ── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Communauté</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total membres"        value={(userCountRes.count    ?? 0).toLocaleString('fr-FR')} sub="Comptes créés" />
          <KpiCard label="Nouveaux aujourd'hui" value={(todaySignupsRes.count  ?? 0).toLocaleString('fr-FR')} sub="Inscriptions 24h" color={(todaySignupsRes.count ?? 0) > 0 ? 'green' : 'white'} />
          <KpiCard label="Nouveaux ce mois"     value={(monthSignupsRes.count  ?? 0).toLocaleString('fr-FR')} sub="Inscriptions mois" />
          <KpiCard label="Marchands actifs"     value={(merchantCountRes.count ?? 0).toLocaleString('fr-FR')} sub="Boutiques actives" />
        </div>
      </div>

      {/* ── Transactions en attente ── */}
      {pendingTxs.length > 0 && (
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-amber-700/40">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">⏳ Transactions en attente</h2>
            <span className="text-amber-400 text-sm font-bold">{pendingTxs.length} en cours</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['Montant', 'Méthode', 'Heure', 'Ancienneté'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs text-gray-400 font-medium uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {pendingTxs.map(tx => {
                const ageMin = Math.floor((now.getTime() - new Date(tx.created_at).getTime()) / 60_000)
                const isOld = ageMin > 10
                return (
                  <tr key={tx.id} className={isOld ? 'bg-amber-900/10' : ''}>
                    <td className="px-5 py-3 text-white font-medium">{formatFcfa(tx.amount_fcfa)} FCFA</td>
                    <td className="px-5 py-3 text-gray-300">{tx.payment_method?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOld ? 'bg-amber-900/50 text-amber-400' : 'text-gray-400'}`}>
                        {ageMin < 60 ? `${ageMin} min` : `${Math.floor(ageMin / 60)}h${ageMin % 60}m`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Retraits détaillés ── */}
      {pendingWithdrawals.length > 0 && (
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">💸 Retraits à traiter</h2>
            <span className="text-red-400 text-sm font-bold">{formatFcfa(totalPendingWithdrawal)} FCFA à décaisser</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['Montant', 'Opérateur', 'Téléphone', 'Depuis'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs text-gray-400 font-medium uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {pendingWithdrawals.map(w => {
                const ageH = Math.floor((now.getTime() - new Date(w.created_at).getTime()) / 3_600_000)
                const isLate = ageH > 12
                return (
                  <tr key={w.id} className={isLate ? 'bg-red-900/10' : ''}>
                    <td className="px-5 py-3 text-white font-medium">{formatFcfa(w.amount_fcfa)} {w.currency_type?.toUpperCase()}</td>
                    <td className="px-5 py-3 text-gray-300">{w.operator?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-300 font-mono text-xs">{w.phone}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isLate ? 'bg-red-900/50 text-red-400' : 'text-gray-400'}`}>
                        {ageH < 1 ? '< 1h' : `${ageH}h`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Historique des encaissements float ── */}
      {floatEntries.length > 0 && (
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="text-white font-semibold">📋 Historique des encaissements</h2>
            <p className="text-gray-500 text-xs mt-0.5">Les 50 dernières entrées float — toutes méthodes confondues</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {['Date', 'Type', 'Montant', 'Marchand / Réf.', 'Notes', 'Saisie par'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {floatEntries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-700/20">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(e.entry_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENTRY_COLORS[e.entry_type] ?? 'bg-gray-700 text-gray-300'}`}>
                        {ENTRY_LABELS[e.entry_type] ?? e.entry_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold whitespace-nowrap ${
                      e.entry_type === 'adjustment_minus' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {e.entry_type === 'adjustment_minus' ? '−' : '+'}{formatFcfa(e.amount_fcfa)} FCFA
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-[160px] truncate">
                      {e.merchant_name ?? e.operator_ref ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                      {e.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {e.recorder_name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center text-gray-600 text-xs pb-4">
        GreenFlame · Réconciliation du float · Actualisez la page pour rafraîchir les données
      </div>
    </div>
  )
}
