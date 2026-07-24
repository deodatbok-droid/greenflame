import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 0

function fmtFcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_assignment: { label: 'Sans livreur', color: 'bg-amber-100 text-amber-700' },
  assigned:           { label: 'Livreur assigné', color: 'bg-blue-100 text-blue-700' },
  picked_up:          { label: 'Pris en charge', color: 'bg-purple-100 text-purple-700' },
  in_transit:         { label: 'En route', color: 'bg-indigo-100 text-indigo-700' },
  delivered:          { label: 'Livré ✓', color: 'bg-green-100 text-green-700' },
  failed_delivery:    { label: 'Échec / Litige', color: 'bg-red-100 text-red-700' },
  cancelled:          { label: 'Annulé', color: 'bg-gray-100 text-gray-500' },
}

export default async function MerchantDeliveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/merchant/activate')

  // Commandes livraison de ce marchand
  const { data: orders } = await svc
    .from('delivery_orders')
    .select(`
      id, status, delivery_address, delivery_fee_fcfa, created_at, assigned_at, delivered_at,
      transactions(id, amount_fcfa, escrow_status),
      delivery_providers(display_name, phone),
      users!buyer_id(full_name, phone)
    `)
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const pending  = (orders ?? []).filter(o => !['delivered', 'cancelled'].includes(o.status))
  const done     = (orders ?? []).filter(o => ['delivered', 'cancelled', 'failed_delivery'].includes(o.status))

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🚴 Livraisons</h1>
          <p className="text-sm text-gray-500">{merchant.business_name}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">← Outils</Link>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{(orders ?? []).filter(o => o.status === 'pending_assignment').length}</div>
          <div className="text-xs text-amber-600 mt-0.5">Sans livreur</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{(orders ?? []).filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length}</div>
          <div className="text-xs text-blue-600 mt-0.5">En cours</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{(orders ?? []).filter(o => o.status === 'delivered').length}</div>
          <div className="text-xs text-green-600 mt-0.5">Livrées</div>
        </div>
      </div>

      {/* Commandes en cours */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">En cours ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
            Aucune livraison en cours.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(order => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
              const tx = order.transactions as unknown as { id: string; amount_fcfa: number; escrow_status: string } | null
              const provider = order.delivery_providers as unknown as { display_name: string; phone: string } | null
              const buyer = (order as any).users as { full_name: string; phone: string } | null
              return (
                <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <div className="text-xs text-gray-500 mt-1">{fmtDate(order.created_at)}</div>
                    </div>
                    {tx && (
                      <div className="text-right">
                        <div className="font-bold text-gray-900 text-sm">{fmtFcfa(tx.amount_fcfa)}</div>
                        <div className="text-[10px] text-amber-600">
                          {tx.escrow_status === 'held' ? '⏳ Escrow' : tx.escrow_status === 'released' ? '✅ Libéré' : tx.escrow_status}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex gap-2">
                      <span className="text-gray-500 shrink-0">📍</span>
                      <span>{order.delivery_address}</span>
                    </div>
                    {buyer && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 shrink-0">👤</span>
                        <span>{buyer.full_name} — {buyer.phone}</span>
                      </div>
                    )}
                    {provider ? (
                      <div className="flex gap-2">
                        <span className="text-gray-500 shrink-0">🚴</span>
                        <span>{provider.display_name} ({provider.phone})</span>
                      </div>
                    ) : (
                      <div className="text-amber-600 font-medium">⚠ Aucun livreur assigné</div>
                    )}
                  </div>
                  {order.status === 'pending_assignment' && (
                    <Link
                      href={`/delivery/providers?order=${order.id}`}
                      className="mt-3 block text-center text-xs bg-brand-600 text-white py-2 rounded-lg font-medium"
                    >
                      Trouver un livreur
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Commandes terminées */}
      {done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Terminées ({done.length})</h2>
          <div className="space-y-2">
            {done.slice(0, 10).map(order => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
              const tx = order.transactions as unknown as { amount_fcfa: number } | null
              return (
                <div key={order.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    <div className="text-xs text-gray-500 mt-1">{order.delivery_address}</div>
                    <div className="text-[10px] text-gray-500">{fmtDate(order.created_at)}</div>
                  </div>
                  {tx && <div className="font-semibold text-gray-600 text-sm">{fmtFcfa(tx.amount_fcfa)}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
