import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import ContactButton from '@/components/messaging/ContactButton'

export const revalidate = 0

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Retourne (étape active 0-4, libellé, couleur, icône) selon les statuts combinés
function getOrderStep(txStatus: string, escrowStatus: string | null, deliveryStatus: string | null) {
  // Pickup direct ou POS : complété immédiatement
  if (txStatus === 'completed' && !escrowStatus) {
    return { step: 4, label: 'Vendu ✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
  }
  if (txStatus === 'failed' || txStatus === 'refunded') {
    return { step: -1, label: 'Annulée', color: 'text-red-500', bg: 'bg-red-50 border-red-200' }
  }
  if (txStatus === 'disputed') {
    return { step: -1, label: '⚠ Litige', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
  }
  // Escrow flow
  if (escrowStatus === 'released' && txStatus === 'completed') {
    return { step: 4, label: 'Livré & payé ✓', color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
  }
  if (deliveryStatus === 'delivered') {
    return { step: 3, label: 'Livré — attente confirmation', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' }
  }
  if (deliveryStatus === 'in_transit' || deliveryStatus === 'picked_up') {
    return { step: 3, label: 'En route 🚴', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' }
  }
  if (deliveryStatus === 'assigned') {
    return { step: 2, label: 'Livreur assigné', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' }
  }
  if (deliveryStatus === 'pending_assignment' || escrowStatus === 'held') {
    return { step: 1, label: 'En préparation', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
  }
  if (txStatus === 'pending' || txStatus === 'processing') {
    return { step: 0, label: 'Paiement en attente', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' }
  }
  return { step: 4, label: 'Terminée', color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
}

const PIPELINE_STEPS = ['Payé', 'Préparation', 'En route', 'Livré']

export default async function MerchantHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/dashboard')

  // Transactions + delivery_orders joinées
  const { data: rawTxs } = await svc
    .from('transactions')
    .select(`
      id, amount_fcfa, commission_total, status, payment_method, created_at,
      delivery_type, escrow_status, escrow_expires_at,
      buyers:buyer_id(full_name, phone),
      delivery_orders(id, status, delivery_address, provider_id,
        delivery_providers(display_name, phone)
      )
    `)
    .eq('merchant_id', merchant.id)
    .not('status', 'in', '("failed","refunded")')
    .order('created_at', { ascending: false })
    .limit(100)

  const txs = (rawTxs ?? []).map((tx) => {
    const deliveryOrder = Array.isArray(tx.delivery_orders)
      ? (tx.delivery_orders[0] ?? null)
      : (tx.delivery_orders ?? null)
    return { ...tx, deliveryOrder }
  })

  // Segmenter
  const toProcess = txs.filter((tx) => {
    if (tx.status === 'pending' || tx.status === 'processing') return true
    if (tx.escrow_status === 'held') return true
    if (tx.deliveryOrder?.status === 'pending_assignment') return true
    return false
  })

  const inProgress = txs.filter((tx) => {
    if (toProcess.includes(tx)) return false
    if (tx.deliveryOrder && ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(tx.deliveryOrder.status)) return true
    return false
  })

  const done = txs.filter((tx) => !toProcess.includes(tx) && !inProgress.includes(tx))

  function OrderCard({ tx }: { tx: typeof txs[0] }) {
    const buyer = tx.buyers as unknown as { full_name: string; phone: string } | null
    const dOrder = tx.deliveryOrder as any
    const provider = dOrder?.delivery_providers as { display_name: string; phone: string } | null
    const { step, label, color, bg } = getOrderStep(
      tx.status,
      tx.escrow_status ?? null,
      dOrder?.status ?? null
    )
    const hasDelivery = tx.delivery_type === 'delivery'
    const showPipeline = hasDelivery && step >= 0

    return (
      <div className={`rounded-2xl border p-4 ${bg}`}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{buyer?.full_name ?? 'Client'}</p>
            <p className="text-xs text-gray-500">{buyer?.phone}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(tx.created_at)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-gray-900">{formatFcfa(tx.amount_fcfa)}</p>
            <p className="text-xs text-gray-400">net : {formatFcfa(tx.amount_fcfa - tx.commission_total)}</p>
            <span className={`text-xs font-semibold ${color}`}>{label}</span>
          </div>
        </div>

        {/* Tracker pipeline livraison */}
        {showPipeline && (
          <div className="mb-3">
            <div className="flex items-center gap-0">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                    i < step ? 'bg-green-500 text-white' :
                    i === step ? 'bg-brand-600 text-white ring-2 ring-brand-200' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {PIPELINE_STEPS.map((s, i) => (
                <p key={i} className={`text-[9px] ${i === step ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
                  {s}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Infos livreur */}
        {dOrder && provider && (
          <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
            <span>🚴</span>
            <span>{provider.display_name}</span>
            <span className="text-gray-400">·</span>
            <a href={`tel:${provider.phone}`} className="text-brand-600">{provider.phone}</a>
          </div>
        )}
        {dOrder?.delivery_address && (
          <div className="text-xs text-gray-500 mb-2 flex gap-1.5">
            <span className="flex-shrink-0">📍</span>
            <span>{dOrder.delivery_address}</span>
          </div>
        )}

        {/* Escrow warning */}
        {tx.escrow_status === 'held' && tx.escrow_expires_at && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-2">
            ⏳ Fonds en escrow — libération auto le{' '}
            {new Date(tx.escrow_expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <ContactButton transactionId={tx.id} label="💬 Client" className="text-xs text-brand-600 font-semibold hover:underline" />
          {dOrder?.status === 'pending_assignment' && (
            <Link
              href={`/delivery/providers?order=${dOrder.id}`}
              className="text-xs bg-brand-600 text-white px-2.5 py-1 rounded-lg font-semibold"
            >
              + Assigner livreur
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg text-gray-900">📦 Mes Commandes</h1>
          <Link href="/merchant/dashboard" className="text-sm text-brand-600">← Retour</Link>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{merchant.business_name}</p>
      </div>

      <div className="p-4 space-y-6">
        {/* À traiter */}
        {toProcess.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full inline-block" />
              À traiter ({toProcess.length})
            </h2>
            <div className="space-y-3">
              {toProcess.map((tx) => <OrderCard key={tx.id} tx={tx} />)}
            </div>
          </section>
        )}

        {/* En cours */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
              En cours ({inProgress.length})
            </h2>
            <div className="space-y-3">
              {inProgress.map((tx) => <OrderCard key={tx.id} tx={tx} />)}
            </div>
          </section>
        )}

        {/* Terminées */}
        {done.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              Terminées ({done.length})
            </h2>
            <div className="space-y-2">
              {done.slice(0, 20).map((tx) => {
                const buyer = tx.buyers as unknown as { full_name: string } | null
                const { label, color } = getOrderStep(tx.status, tx.escrow_status ?? null, (tx.deliveryOrder as any)?.status ?? null)
                return (
                  <div key={tx.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{buyer?.full_name ?? 'Client'}</p>
                      <p className="text-xs text-gray-400">{fmtDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{formatFcfa(tx.amount_fcfa)}</p>
                      <span className={`text-xs font-medium ${color}`}>{label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {txs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📦</p>
            <p className="font-semibold text-gray-600">Aucune commande</p>
            <p className="text-sm mt-1">Vos ventes apparaîtront ici dès le premier achat.</p>
            <Link href="/merchant/receive" className="inline-block mt-4 bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              Encaisser un paiement →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
