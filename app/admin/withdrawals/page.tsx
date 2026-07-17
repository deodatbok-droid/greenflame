import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import WithdrawActionButton from '@/components/admin/WithdrawActionButton'
import { requireAdmin } from '@/lib/utils/admin-guard'

export default async function AdminWithdrawalsPage() {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: pending } = await svc
    .from('withdrawal_requests')
    .select('id, created_at, amount_fcfa, currency_type, operator, phone, status, source, merchant_id, user_id, users(full_name, phone), merchants(business_name)')
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: recent } = await svc
    .from('withdrawal_requests')
    .select('id, created_at, amount_fcfa, currency_type, operator, phone, status, processed_at, users(full_name)')
    .in('status', ['completed', 'failed'])
    .order('processed_at', { ascending: false })
    .limit(20)

  const pendingList = (pending ?? []).filter(r => r.status === 'pending')
  const total = pendingList.reduce((s, r) => s + r.amount_fcfa, 0)

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400 text-sm">Retraits</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Retraits en attente</h1>
        <p className="text-gray-400 text-sm mt-1">Traitez les demandes de retrait Mobile Money.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">En attente</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">{pendingList.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Montant total</p>
          <p className="text-2xl font-bold text-white mt-1">{formatFcfa(total)} FCFA</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Traités récemment</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{(recent ?? []).filter(r => r.status === 'completed').length}</p>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-white">En attente ({pendingList.length})</h2>
          <p className="text-xs text-gray-500">À traiter manuellement via MoMo Business</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Utilisateur', 'Montant', 'Opérateur', 'Numéro', 'Date', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {pendingList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun retrait en attente</td></tr>
              ) : pendingList.map(r => {
                const u = r.users as unknown as { full_name: string; phone: string } | null
                const m = r.merchants as unknown as { business_name: string } | null
                const isMerchant = r.source === 'merchant'
                return (
                  <tr key={r.id} className="hover:bg-gray-700/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isMerchant ? 'bg-amber-900/40 text-amber-300' : 'bg-gray-700 text-gray-400'}`}>
                          {isMerchant ? '🏪 Boutique' : '👤 Perso'}
                        </span>
                      </div>
                      <Link href={`/admin/users/${r.user_id}`} className="text-brand-400 hover:underline text-sm mt-0.5 block">
                        {u?.full_name ?? '—'}
                      </Link>
                      {isMerchant && m && (
                        <p className="text-xs text-amber-400/70">{m.business_name}</p>
                      )}
                      <p className="text-xs text-gray-500">{u?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-white font-bold">{formatFcfa(r.amount_fcfa)} <span className="text-xs text-gray-400">{r.currency_type.toUpperCase()}</span></td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{r.operator === 'mtn_momo' ? 'MTN MoMo' : 'Moov Flooz'}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{r.phone}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <WithdrawActionButton withdrawalId={r.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent */}
      {(recent ?? []).length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="font-semibold text-white">Traités récemment</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-700/30">
                {(recent ?? []).map(r => {
                  const u = r.users as unknown as { full_name: string } | null
                  return (
                    <tr key={r.id} className="hover:bg-gray-700/20">
                      <td className="px-4 py-3 text-white text-sm">{u?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-white font-medium">{formatFcfa(r.amount_fcfa)} FCFA</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-lg ${r.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                          {r.status === 'completed' ? 'Complété' : 'Échoué'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.processed_at ? new Date(r.processed_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
