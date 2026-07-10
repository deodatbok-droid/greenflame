import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import MerchantAdminPanel from './MerchantAdminPanel'
import AgentServicePanel from './AgentServicePanel'
import { requireAdmin } from '@/lib/utils/admin-guard'

export default async function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const supabase = await createClient()
  const { id } = await params

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [merchantRes, txRes, productRes, monthTxRes] = await Promise.all([
    supabase.from('merchants')
      .select('id, business_name, business_category, commission_rate, address_text, is_active, is_verified, total_gmv, created_at, agent_service_active, users(id, full_name, phone)')
      .eq('id', id)
      .single(),
    supabase.from('transactions')
      .select('id, amount_fcfa, commission_total, status, payment_method, created_at, buyer_id, buyer:users!buyer_id(full_name, phone)')
      .eq('merchant_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('products')
      .select('id, name, price_fcfa, emoji, is_available, category')
      .eq('merchant_id', id)
      .order('sort_order'),
    supabase.from('transactions')
      .select('amount_fcfa')
      .eq('merchant_id', id)
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString()),
  ])

  if (!merchantRes.data) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/merchants" className="text-gray-400 hover:text-white text-sm">← Marchands</Link>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400">Fiche introuvable</span>
        </div>
        <div className="bg-gray-800 rounded-xl p-10 text-center border border-gray-700">
          <p className="text-4xl mb-4">🏪</p>
          <p className="text-white font-semibold text-lg mb-2">Aucune fiche marchand trouvée</p>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Ce marchand n&apos;a pas encore de compte actif, aucun article créé, ou aucune transaction enregistrée.
            La fiche sera disponible dès que le marchand aura complété son activation.
          </p>
          <Link href="/admin/merchants" className="mt-6 inline-block bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors">
            Retour à la liste →
          </Link>
        </div>
      </div>
    )
  }
  const m = merchantRes.data
  const txList = txRes.data ?? []
  const products = productRes.data ?? []
  const monthTxs = monthTxRes.data ?? []
  const owner = m.users as unknown as { id: string; full_name: string; phone: string } | null

  const txCount     = txList.length
  const completedTx = txList.filter(t => t.status === 'completed').length
  const monthlyGmv  = monthTxs.reduce((s, t) => s + t.amount_fcfa, 0)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/merchants" className="text-gray-400 hover:text-white text-sm">← Marchands</Link>
          <span className="text-gray-600">/</span>
          <span className="text-white font-medium">{m.business_name}</span>
        </div>
        <Link
          href={`/admin/merchants/${m.id}/kit`}
          target="_blank"
          className="flex items-center gap-2 bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          🖨️ Kit marchand
        </Link>
      </div>

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{m.business_name}</h1>
              <p className="text-gray-400 text-sm">{m.business_category}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`badge text-xs ${m.is_active ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                {m.is_active ? 'Actif' : 'Inactif'}
              </span>
              {m.is_verified && (
                <span className="badge text-xs bg-blue-900/30 text-blue-300">Verifie ✓</span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Commission : <span className="text-brand-400 font-semibold text-sm">{(m.commission_rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}%</span></p>
            {m.address_text && <p>Adresse : <span className="text-gray-300">{m.address_text}</span></p>}
            <p>Enrole le : <span className="text-gray-300">{new Date(m.created_at).toLocaleDateString('fr-FR')}</span></p>
          </div>
          {owner && (
            <div className="border-t border-gray-700 pt-3">
              <p className="text-xs text-gray-400 mb-1">Proprietaire</p>
              <Link href={`/admin/users/${owner.id}`} className="text-brand-400 hover:text-brand-300 font-medium text-sm">
                {owner.full_name}
              </Link>
              <p className="text-gray-500 text-xs">{owner.phone}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <MerchantAdminPanel
            merchantId={m.id}
            initialRate={m.commission_rate}
            initialActive={m.is_active}
            initialVerified={m.is_verified}
          />
          <AgentServicePanel
            merchantId={m.id}
            isActive={m.agent_service_active ?? false}
            monthlyGmv={monthlyGmv}
          />
        </div>

        <div className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Statistiques</h2>
          <div>
            <p className="text-3xl font-bold text-white">{formatFcfa(m.total_gmv)}</p>
            <p className="text-gray-400 text-sm">GMV total</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-400">Transactions</p>
              <p className="font-bold text-white text-lg">{txCount}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-400">Completees</p>
              <p className="font-bold text-green-400 text-lg">{completedTx}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2">
              <p className="text-xs text-gray-400">Produits</p>
              <p className="font-bold text-brand-400 text-lg">{products.length}</p>
            </div>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Commissions generees</p>
            <p className="font-bold text-brand-400">
              {formatFcfa(txList.reduce((s, t) => s + t.commission_total, 0))} FCFA
            </p>
          </div>
        </div>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="font-semibold text-white">Catalogue produits ({products.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            {products.map(p => (
              <div key={p.id} className={`bg-gray-700/40 rounded-xl p-3 ${!p.is_available ? 'opacity-50' : ''}`}>
                <p className="text-2xl mb-1">{p.emoji}</p>
                <p className="font-medium text-white text-sm line-clamp-1">{p.name}</p>
                <p className="text-brand-400 text-sm font-semibold">{formatFcfa(p.price_fcfa)} FCFA</p>
                {!p.is_available && <p className="text-xs text-red-400 mt-0.5">Indisponible</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white">Transactions ({txList.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Acheteur', 'Montant', 'Commission', 'Methode', 'Statut', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {txList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune transaction</td></tr>
              ) : txList.map(tx => {
                const buyer = tx.buyer as unknown as { full_name: string; phone: string } | null
                return (
                  <tr key={tx.id} className="hover:bg-gray-700/20">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${tx.buyer_id}`} className="text-brand-400 hover:underline text-sm">
                        {buyer?.full_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{formatFcfa(tx.amount_fcfa)}</td>
                    <td className="px-4 py-3 text-brand-400">{formatFcfa(tx.commission_total)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{tx.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${tx.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
