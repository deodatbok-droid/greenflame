import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import TransactionsTable from './TransactionsTable'
import { requireAdmin } from '@/lib/utils/admin-guard'
import Link from 'next/link'

export interface DistRow {
  distribution_type: string
  level: number | null
  amount_fcfa: number
  is_gfp: boolean
  recipient_name: string | null
}

export interface TxRow {
  id: string
  amount_fcfa: number
  commission_total: number
  status: string
  payment_method: string | null
  idempotency_key: string | null
  created_at: string
  merchant_name: string | null
  buyer_name: string | null
  buyer_phone: string | null
  distributions: DistRow[]
  // Fraude IA
  fraud_score:     number | null
  fraud_level:     'low' | 'medium' | 'high' | null
  fraud_flags:     string[] | null
  fraud_narrative: string | null
  fraud_reviewed:  boolean
}

export default async function AdminTransactionsPage() {
  await requireAdmin()

  const svc = createServiceClient()

  const { data: transactions } = await svc
    .from('transactions')
    .select('id, amount_fcfa, commission_total, status, payment_method, idempotency_key, created_at, merchant_id, buyer_id, fraud_score, fraud_level, fraud_flags, fraud_narrative, fraud_reviewed')
    .order('created_at', { ascending: false })
    .limit(200)

  const txList = transactions ?? []
  const txIds = txList.map(t => t.id)

  const merchantIds = [...new Set(txList.map(t => t.merchant_id).filter(Boolean))]
  const buyerIds    = [...new Set(txList.map(t => t.buyer_id).filter(Boolean))]

  // Fetch all distributions for these transactions in one query
  const [merchantsRes, buyersRes, distRes] = await Promise.all([
    merchantIds.length > 0
      ? svc.from('merchants').select('id, business_name').in('id', merchantIds)
      : { data: [] },
    buyerIds.length > 0
      ? svc.from('users').select('id, full_name, phone').in('id', buyerIds)
      : { data: [] },
    txIds.length > 0
      ? svc.from('commission_distributions')
          .select('transaction_id, distribution_type, level, amount_fcfa, is_gfp, recipient_id')
          .in('transaction_id', txIds)
      : { data: [] },
  ])

  // Resolve distribution recipients
  const recipientIds = [...new Set(
    (distRes.data ?? []).map(d => d.recipient_id).filter(Boolean) as string[]
  )]
  const { data: recipientUsers } = recipientIds.length > 0
    ? await svc.from('users').select('id, full_name').in('id', recipientIds)
    : { data: [] }

  const merchantMap   = Object.fromEntries((merchantsRes.data ?? []).map(m => [m.id, m]))
  const buyerMap      = Object.fromEntries((buyersRes.data  ?? []).map(u => [u.id, u]))
  const recipientMap  = Object.fromEntries((recipientUsers  ?? []).map(u => [u.id, u.full_name]))

  // Group distributions by transaction_id
  const distsByTx = (distRes.data ?? []).reduce((acc, d) => {
    if (!acc[d.transaction_id]) acc[d.transaction_id] = []
    acc[d.transaction_id].push({
      distribution_type: d.distribution_type,
      level:             d.level,
      amount_fcfa:       d.amount_fcfa,
      is_gfp:            d.is_gfp ?? false,
      recipient_name:    d.recipient_id ? (recipientMap[d.recipient_id] ?? 'Inconnu') : null,
    })
    return acc
  }, {} as Record<string, DistRow[]>)

  const enriched: TxRow[] = txList.map(tx => ({
    id:               tx.id,
    amount_fcfa:      tx.amount_fcfa,
    commission_total: tx.commission_total,
    status:           tx.status,
    payment_method:   tx.payment_method,
    created_at:       tx.created_at,
    merchant_name:    merchantMap[tx.merchant_id]?.business_name ?? null,
    buyer_name:       buyerMap[tx.buyer_id]?.full_name ?? null,
    buyer_phone:      buyerMap[tx.buyer_id]?.phone ?? null,
    idempotency_key:  (tx as Record<string, unknown>).idempotency_key as string | null ?? null,
    distributions:    distsByTx[tx.id] ?? [],
    fraud_score:      (tx as Record<string, unknown>).fraud_score as number | null ?? null,
    fraud_level:      (tx as Record<string, unknown>).fraud_level as 'low' | 'medium' | 'high' | null ?? null,
    fraud_flags:      (tx as Record<string, unknown>).fraud_flags as string[] | null ?? null,
    fraud_narrative:  (tx as Record<string, unknown>).fraud_narrative as string | null ?? null,
    fraud_reviewed:   Boolean((tx as Record<string, unknown>).fraud_reviewed),
  }))

  const completed       = enriched.filter(t => t.status === 'completed')
  const totalGmv        = completed.reduce((s, t) => s + t.amount_fcfa, 0)
  const totalCommission = completed.reduce((s, t) => s + t.commission_total, 0)

  const fraudHigh    = enriched.filter(t => t.fraud_level === 'high' && !t.fraud_reviewed)
  const fraudMedium  = enriched.filter(t => t.fraud_level === 'medium' && !t.fraud_reviewed)

  const startOfMonth = new Date(); startOfMonth.setDate(1)
  const { data: spillover } = await svc
    .from('spillover_fund')
    .select('id, amount_fcfa, reason, created_at')
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  const spilloverTotal = (spillover ?? []).reduce((s, sp) => s + sp.amount_fcfa, 0)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Transactions</span>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        {(fraudHigh.length > 0 || fraudMedium.length > 0) && (
          <div className="flex items-center gap-3">
            {fraudHigh.length > 0 && (
              <span className="flex items-center gap-1.5 bg-red-900/40 text-red-400 text-sm px-3 py-1.5 rounded-full font-medium animate-pulse">
                🚨 {fraudHigh.length} alerte{fraudHigh.length > 1 ? 's' : ''} haute
              </span>
            )}
            {fraudMedium.length > 0 && (
              <span className="flex items-center gap-1.5 bg-yellow-900/30 text-yellow-400 text-sm px-3 py-1.5 rounded-full">
                ⚠️ {fraudMedium.length} à vérifier
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Transactions"      value={txList.length.toString()}            color="white"  />
        <StatCard label="GMV (liste)"       value={`${formatFcfa(totalGmv)} FCFA`}      color="green"  />
        <StatCard label="Commissions"       value={`${formatFcfa(totalCommission)} FCFA`} color="brand" />
        <StatCard label="Spillover (mois)"  value={`${formatFcfa(spilloverTotal)} FCFA`} color="yellow" />
      </div>

      {(spillover ?? []).length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-yellow-400 mb-3">Spillover Fund — Ce mois</h2>
          <p className="text-2xl font-bold text-white mb-3">{formatFcfa(spilloverTotal)} FCFA</p>
          <div className="space-y-1">
            {(spillover ?? []).slice(0, 5).map(sp => (
              <div key={sp.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex-1">{sp.reason}</span>
                <span className="text-yellow-400 mx-4">{formatFcfa(sp.amount_fcfa)} FCFA</span>
                <span className="text-gray-500 text-xs">{new Date(sp.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="font-semibold text-white mb-4">200 dernières transactions — cliquez pour voir le détail</h2>
        <TransactionsTable txList={enriched} />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const textColor =
    color === 'green'  ? 'text-green-400'  :
    color === 'brand'  ? 'text-brand-400'  :
    color === 'yellow' ? 'text-yellow-400' : 'text-white'
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  )
}
