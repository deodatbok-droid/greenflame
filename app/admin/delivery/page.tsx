import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 0

function fmtFcfa(n: number) { return n.toLocaleString('fr-FR') + ' FCFA' }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function AdminDeliveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  const [{ data: orders }, { data: providers }, { data: escrowTxs }] = await Promise.all([
    svc
      .from('delivery_orders')
      .select(`
        id, status, delivery_address, delivery_fee_fcfa, commission_fcfa, created_at, delivered_at,
        merchants(business_name),
        delivery_providers(display_name, phone, avg_rating),
        users!buyer_id(full_name, phone),
        transactions(id, amount_fcfa, escrow_status, escrow_expires_at)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    svc
      .from('delivery_providers')
      .select('id, display_name, phone, provider_type, avg_rating, nb_deliveries, is_active, is_verified, created_at')
      .order('created_at', { ascending: false }),
    svc
      .from('transactions')
      .select('id, amount_fcfa, escrow_status, escrow_expires_at, buyer_id, merchant_id')
      .eq('status', 'escrow')
      .eq('escrow_status', 'held')
      .order('escrow_expires_at', { ascending: true }),
  ])

  const activeProviders = (providers ?? []).filter(p => p.is_active)
  const totalEscrow = (escrowTxs ?? []).reduce((s, t) => s + (t.amount_fcfa ?? 0), 0)
  const pendingOrders = (orders ?? []).filter(o => o.status === 'pending_assignment')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">GreenFlame Delivery</h1>
        <p className="text-gray-400 text-sm mt-1">Supervision des livraisons, livreurs et escrows</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Escrow total</p>
          <p className="text-2xl font-bold text-amber-400">{fmtFcfa(totalEscrow)}</p>
          <p className="text-gray-500 text-xs mt-1">{(escrowTxs ?? []).length} transactions</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Sans livreur</p>
          <p className="text-2xl font-bold text-red-400">{pendingOrders.length}</p>
          <p className="text-gray-500 text-xs mt-1">commandes non assignées</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Livreurs actifs</p>
          <p className="text-2xl font-bold text-green-400">{activeProviders.length}</p>
          <p className="text-gray-500 text-xs mt-1">sur {(providers ?? []).length} inscrits</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Total livraisons</p>
          <p className="text-2xl font-bold text-white">{(orders ?? []).length}</p>
          <p className="text-gray-500 text-xs mt-1">
            {(orders ?? []).filter(o => o.status === 'delivered').length} réussies
          </p>
        </div>
      </div>

      {/* Escrows actifs */}
      {(escrowTxs ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            ⏳ Escrows actifs — libération auto à 48h
          </h2>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-700 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Transaction</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-right px-4 py-3">Expire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(escrowTxs ?? []).slice(0, 10).map(tx => {
                  const expiry = new Date(tx.escrow_expires_at!)
                  const hoursLeft = Math.ceil((expiry.getTime() - Date.now()) / (60 * 60 * 1000))
                  const urgent = hoursLeft < 6
                  return (
                    <tr key={tx.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{tx.id.slice(0, 12)}…</td>
                      <td className="px-4 py-3 text-right text-white font-semibold">{fmtFcfa(tx.amount_fcfa)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-medium ${urgent ? 'text-red-400' : 'text-gray-400'}`}>
                        {urgent ? `⚠ ${hoursLeft}h` : fmtDate(tx.escrow_expires_at!)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commandes récentes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Commandes livraison récentes
        </h2>
        {(orders ?? []).length === 0 ? (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 text-center text-gray-500">
            Aucune commande de livraison pour l&apos;instant.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-700 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Marchand / Acheteur</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Adresse</th>
                  <th className="text-left px-4 py-3">Livreur</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(orders ?? []).slice(0, 20).map(order => {
                  const merchant = order.merchants as unknown as { business_name: string } | null
                  const buyer = (order as any).users as { full_name: string } | null
                  const provider = order.delivery_providers as unknown as { display_name: string; avg_rating: number | null } | null
                  const tx = order.transactions as unknown as { amount_fcfa: number } | null
                  const statusColors: Record<string, string> = {
                    pending_assignment: 'text-amber-400',
                    assigned:           'text-blue-400',
                    picked_up:          'text-purple-400',
                    in_transit:         'text-indigo-400',
                    delivered:          'text-green-400',
                    failed_delivery:    'text-red-400',
                    cancelled:          'text-gray-500',
                  }
                  return (
                    <tr key={order.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="text-white text-xs font-medium">{merchant?.business_name ?? '—'}</div>
                        <div className="text-gray-500 text-xs">{buyer?.full_name ?? '—'}</div>
                        <div className="text-gray-600 text-[10px]">{fmtDate(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs max-w-32 truncate">{order.delivery_address}</td>
                      <td className="px-4 py-3">
                        {provider ? (
                          <div>
                            <div className="text-gray-300 text-xs">{provider.display_name}</div>
                            {provider.avg_rating && (
                              <div className="text-yellow-400 text-[10px]">★ {provider.avg_rating}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-400 text-xs">Non assigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${statusColors[order.status] ?? 'text-gray-400'}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-white text-xs font-semibold">
                        {tx ? fmtFcfa(tx.amount_fcfa) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Livreurs */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Prestataires de livraison ({(providers ?? []).length})
        </h2>
        {(providers ?? []).length === 0 ? (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 text-center text-gray-500">
            Aucun prestataire inscrit pour l&apos;instant.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-700 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Nom</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="text-right px-4 py-3">Note</th>
                  <th className="text-right px-4 py-3">Livraisons</th>
                  <th className="text-center px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(providers ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-medium">{p.display_name}</div>
                      <div className="text-gray-500 text-[10px]">{p.phone}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs capitalize">{p.provider_type}</td>
                    <td className="px-4 py-3 text-right">
                      {p.avg_rating ? (
                        <span className="text-yellow-400 text-xs">★ {p.avg_rating}</span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 text-xs">{p.nb_deliveries}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.is_verified ? 'bg-green-900 text-green-300' :
                        p.is_active   ? 'bg-amber-900 text-amber-300' :
                                        'bg-gray-700 text-gray-400'
                      }`}>
                        {p.is_verified ? '✓ Vérifié' : p.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
