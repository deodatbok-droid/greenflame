'use client'

import { useEffect } from 'react'

const METHOD_LABELS: Record<string, string> = {
  cash_confirmed: 'Espèces',
  mtn_momo:       'MTN MoMo',
  moov_money:     'Moov Money',
  celtiis:        'Celtiis',
  wallet_gf:      'Wallet GreenFlame',
}

interface TxItem { product_name: string; quantity: number; unit_price_fcfa: number }
interface Tx {
  id: string
  completed_at: string
  amount_fcfa: number
  commission_total: number
  net_fcfa: number
  payment_method: string
  buyer_name: string
  items: TxItem[]
}

interface Props {
  merchant: { business_name: string; business_category: string; commission_rate: number; is_verified: boolean }
  period: string
  transactions: Tx[]
  summary: { ca: number; commission: number; net: number; count: number }
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function fmtPct(r: number) {
  return (r * 100).toFixed(0) + '%'
}

export default function MerchantStatementClient({ merchant, period, transactions, summary }: Props) {
  const [year, month] = period.split('-')
  const periodLabel = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString('fr-FR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    // Auto-print when the page loads (user can save as PDF from the dialog)
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 20mm 15mm; size: A4; }
          .no-print { display: none !important; }
          /* Masquer le layout merchant (top bar, bottom nav) — n'imprimer que le contenu */
          body * { visibility: hidden; }
          .statement-content, .statement-content * { visibility: visible; }
          .statement-content { position: absolute; left: 0; top: 0; width: 100%; }
        }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #fff; }
      `}</style>

      {/* Bouton impression (masqué à l'impression) */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-green-800 transition-colors"
        >
          🖨️ Imprimer / Enregistrer PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Fermer
        </button>
      </div>

      <div className="statement-content max-w-3xl mx-auto p-8">

        {/* En-tête */}
        <div className="flex items-start justify-between mb-8 border-b-2 border-green-700 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-black">G</span>
              </div>
              <span className="text-green-800 font-black text-xl tracking-tight">GreenFlame</span>
            </div>
            <p className="text-xs text-gray-500">greenflame.africa</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Relevé de ventes</p>
            <p className="text-2xl font-black text-gray-900 capitalize">{periodLabel}</p>
            <p className="text-xs text-gray-500 mt-0.5">Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Infos boutique */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Boutique</p>
              <p className="text-xl font-bold text-gray-900">
                {merchant.business_name}
                {merchant.is_verified && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Vérifié</span>}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{merchant.business_category}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Taux GreenFlame</p>
              <p className="text-lg font-bold text-gray-700">{fmtPct(merchant.commission_rate)}</p>
            </div>
          </div>
        </div>

        {/* Résumé financier */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chiffre d'affaires</p>
            <p className="text-xl font-black text-gray-900">{fmt(summary.ca)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{summary.count} vente{summary.count > 1 ? 's' : ''}</p>
          </div>
          <div className="border border-red-100 rounded-xl p-4 text-center bg-red-50">
            <p className="text-xs text-red-500 uppercase tracking-wide mb-1">Frais GreenFlame</p>
            <p className="text-xl font-black text-red-700">−{fmt(summary.commission)}</p>
            <p className="text-xs text-red-600 mt-0.5">{fmtPct(merchant.commission_rate)} · cashback + communauté</p>
          </div>
          <div className="border border-green-200 rounded-xl p-4 text-center bg-green-50">
            <p className="text-xs text-green-600 uppercase tracking-wide mb-1">Net reçu</p>
            <p className="text-xl font-black text-green-800">+{fmt(summary.net)}</p>
            <p className="text-xs text-green-500 mt-0.5">
              {summary.ca > 0 ? Math.round((summary.net / summary.ca) * 100) : 0}% du CA
            </p>
          </div>
        </div>

        {/* Liste des transactions */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Détail des transactions</p>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Aucune transaction sur cette période</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Date</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Client</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Méthode</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-semibold uppercase">Montant</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-semibold uppercase">Frais</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-semibold uppercase pr-0">Net</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const date = new Date(tx.completed_at)
                  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <tr key={tx.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="py-2.5 text-gray-600">
                        <span className="font-medium">{dateStr}</span>
                        <span className="text-gray-500 ml-1 text-xs">{timeStr}</span>
                      </td>
                      <td className="py-2.5">
                        <p className="font-medium text-gray-800 truncate max-w-[120px]">{tx.buyer_name}</p>
                        {tx.items.length > 0 && (
                          <p className="text-xs text-gray-500 truncate max-w-[120px]">
                            {tx.items.map(it => `${it.quantity > 1 ? `${it.quantity}× ` : ''}${it.product_name}`).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{METHOD_LABELS[tx.payment_method] ?? tx.payment_method}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{tx.amount_fcfa.toLocaleString('fr-FR')}</td>
                      <td className="py-2.5 text-right text-red-500 text-xs">−{tx.commission_total.toLocaleString('fr-FR')}</td>
                      <td className="py-2.5 text-right font-bold text-green-700 pr-0">+{tx.net_fcfa.toLocaleString('fr-FR')}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td colSpan={3} className="pt-3 font-bold text-gray-900">TOTAL</td>
                  <td className="pt-3 text-right font-bold text-gray-900">{summary.ca.toLocaleString('fr-FR')}</td>
                  <td className="pt-3 text-right font-bold text-red-600">−{summary.commission.toLocaleString('fr-FR')}</td>
                  <td className="pt-3 text-right font-black text-green-800 pr-0">+{summary.net.toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="pt-1 text-right text-xs text-gray-500">Montants en FCFA</td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            <p className="font-semibold text-gray-600">GreenFlame Africa SAS</p>
            <p>Cotonou, Bénin · greenflame.africa</p>
          </div>
          <div className="text-right">
            <p>Relevé généré automatiquement</p>
            <p>Ce document est non contractuel</p>
          </div>
        </div>

      </div>
    </>
  )
}
