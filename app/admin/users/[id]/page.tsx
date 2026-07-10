import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import PromoteUserPanel from './PromoteUserPanel'
import WalletCreditPanel from './WalletCreditPanel'
import InitiateWithdrawalPanel from './InitiateWithdrawalPanel'
import ResetPinPanel from './ResetPinPanel'
import { requireAdmin } from '@/lib/utils/admin-guard'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const supabase = await createClient()
  const { id } = await params

  const [userRes, walletRes, networkRes, txRes, commRes, uplineRes, merchantRes] = await Promise.all([
    supabase.from('users')
      .select('id, full_name, phone, role, referral_code, upline_id, is_active, kyc_level, created_at, transaction_pin')
      .eq('id', id)
      .single(),
    supabase.from('wallets')
      .select('balance_fcfa, balance_gfp, total_earned_fcfa, total_spent_fcfa')
      .eq('user_id', id)
      .single(),
    supabase.from('network_tree')
      .select('l1_upline, l2_upline, l3_upline, l4_upline, l5_upline')
      .eq('user_id', id)
      .maybeSingle(),
    supabase.from('transactions')
      .select('id, amount_fcfa, commission_total, status, payment_method, created_at, merchants(business_name)')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('commission_distributions')
      .select('level, amount_fcfa, distribution_type, created_at')
      .eq('recipient_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('network_tree')
      .select('*', { count: 'exact', head: true })
      .or(`l1_upline.eq.${id},l2_upline.eq.${id},l3_upline.eq.${id},l4_upline.eq.${id},l5_upline.eq.${id}`),
    supabase.from('merchants')
      .select('id, business_name, business_category, commission_rate, is_active, is_verified, total_gmv, created_at')
      .eq('user_id', id)
      .maybeSingle(),
  ])

  if (!userRes.data) notFound()
  const u = userRes.data
  const wallet = walletRes.data
  const tree = networkRes.data
  const txList = txRes.data ?? []
  const commList = commRes.data ?? []
  const recruitCount = uplineRes.count ?? 0
  const merchant = merchantRes.data

  // Fetch merchant products if merchant account exists
  const { data: merchantProducts } = merchant
    ? await supabase.from('products')
        .select('id, name, price_fcfa, emoji, is_available, category, stock_quantity')
        .eq('merchant_id', merchant.id)
        .order('sort_order')
    : { data: [] }

  // Fetch upline name if exists
  let uplineName: string | null = null
  if (u.upline_id) {
    const { data: uplineData } = await supabase.from('users').select('full_name').eq('id', u.upline_id).single()
    uplineName = uplineData?.full_name ?? null
  }

  const totalNetworkDiv = commList.filter(c => c.distribution_type === 'network').reduce((s, c) => s + c.amount_fcfa, 0)
  const totalCashback = commList.filter(c => c.distribution_type === 'cashback').reduce((s, c) => s + c.amount_fcfa, 0)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-gray-400 hover:text-white text-sm">← Membres</Link>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium">{u.full_name}</span>
      </div>

      {/* Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Profil</h2>
          <div>
            <p className="text-2xl font-bold text-white">{u.full_name}</p>
            <p className="text-gray-400 text-sm">{u.phone}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(u.role ?? []).map((r: string) => (
              <span key={r} className={`badge text-xs ${
                r === 'admin' ? 'bg-red-900/30 text-red-300' :
                r === 'kingmaker' ? 'bg-yellow-900/30 text-yellow-300' :
                r === 'merchant' ? 'bg-blue-900/30 text-blue-300' :
                'bg-gray-700 text-gray-300'
              }`}>{r}</span>
            ))}
            <span className={`badge text-xs ${u.is_active ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
              {u.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Code parrainage : <span className="font-mono text-gray-300">{u.referral_code}</span></p>
            <p>KYC niveau : <span className="text-gray-300">{u.kyc_level}</span></p>
            <p>PIN configure : <span className={u.transaction_pin ? 'text-green-400' : 'text-gray-500'}>{u.transaction_pin ? 'Oui' : 'Non'}</span></p>
            <p>Inscrit le : <span className="text-gray-300">{new Date(u.created_at).toLocaleDateString('fr-FR')}</span></p>
            {uplineName && <p>Leader communautaire : <span className="text-brand-400">{uplineName}</span></p>}
          </div>
          <PromoteUserPanel userId={u.id} currentRoles={u.role ?? []} />
          {u.transaction_pin && <ResetPinPanel userId={u.id} />}
        </div>

        {/* Wallet */}
        <div className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Wallet</h2>
          <div>
            <p className="text-3xl font-bold text-white">{wallet ? formatFcfa(wallet.balance_fcfa) : '—'}</p>
            <p className="text-gray-400 text-sm">FCFA disponibles</p>
          </div>
          {wallet && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-700/50 rounded-lg p-2">
                <p className="text-xs text-gray-400">GFP</p>
                <p className="font-bold text-brand-400">{wallet.balance_gfp.toLocaleString()}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Total gagne</p>
                <p className="font-bold text-green-400">{formatFcfa(wallet.total_earned_fcfa)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Dividendes communauté</p>
                <p className="font-bold text-indigo-400">{formatFcfa(totalNetworkDiv)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Cashback total</p>
                <p className="font-bold text-yellow-400">{formatFcfa(totalCashback)}</p>
              </div>
            </div>
          )}
          <WalletCreditPanel userId={u.id} />
        </div>
      </div>

      {/* Initier un retrait pour cet utilisateur */}
      {wallet && (
        <InitiateWithdrawalPanel
          targetUserId={u.id}
          balanceFcfa={wallet.balance_fcfa}
        />
      )}

      {/* Merchant account */}
      {merchant && (
        <div className="bg-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Compte marchand</h2>
              <p className="text-xl font-bold text-white">{merchant.business_name}</p>
              <p className="text-gray-400 text-sm">{merchant.business_category}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`badge text-xs ${merchant.is_active ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                {merchant.is_active ? 'Actif' : 'Inactif'}
              </span>
              {merchant.is_verified && (
                <span className="badge text-xs bg-blue-900/30 text-blue-300">Vérifié ✓</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Commission</p>
              <p className="font-bold text-brand-400 text-lg">{(merchant.commission_rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}%</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">GMV total</p>
              <p className="font-bold text-white text-lg">{formatFcfa(merchant.total_gmv)}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Produits</p>
              <p className="font-bold text-green-400 text-lg">{(merchantProducts ?? []).length}</p>
            </div>
          </div>
          <Link href={`/admin/merchants/${merchant.id}`} className="inline-block text-brand-400 text-sm hover:underline">
            Voir la fiche marchand complète →
          </Link>

          {/* Products */}
          {(merchantProducts ?? []).length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Catalogue</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(merchantProducts ?? []).map(p => (
                  <div key={p.id} className={`bg-gray-700/40 rounded-xl p-3 ${!p.is_available ? 'opacity-50' : ''}`}>
                    <p className="text-2xl mb-1">{p.emoji}</p>
                    <p className="font-medium text-white text-xs leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-brand-400 text-xs font-semibold mt-1">{formatFcfa(p.price_fcfa)} FCFA</p>
                    {p.stock_quantity !== null && (
                      <p className={`text-xs mt-0.5 ${p.stock_quantity === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {p.stock_quantity === 0 ? 'Rupture' : `${p.stock_quantity} en stock`}
                      </p>
                    )}
                    {!p.is_available && <p className="text-xs text-red-400 mt-0.5">Indisponible</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Aucun produit enregistré dans cette boutique.</p>
          )}
        </div>
      )}

      {/* Network position */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Communauté</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{recruitCount}</p>
            <p className="text-xs text-gray-400 mt-1">Membres invités (tous niveaux)</p>
          </div>
          {tree && [
            { key: 'l1_upline', label: 'Upline L1' },
            { key: 'l2_upline', label: 'Upline L2' },
            { key: 'l3_upline', label: 'Upline L3' },
            { key: 'l4_upline', label: 'Upline L4' },
            { key: 'l5_upline', label: 'Upline L5' },
          ].filter(lv => tree[lv.key as keyof typeof tree]).map(lv => (
            <div key={lv.key} className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">{lv.label}</p>
              <Link
                href={`/admin/users/${tree[lv.key as keyof typeof tree]}`}
                className="text-brand-400 text-xs hover:underline font-mono block truncate mt-0.5"
              >
                {tree[lv.key as keyof typeof tree]}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white">Transactions ({txList.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Marchand', 'Montant', 'Commission', 'Methode', 'Statut', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {txList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune transaction</td></tr>
              ) : txList.map(tx => {
                const m = tx.merchants as unknown as { business_name: string } | null
                return (
                  <tr key={tx.id} className="hover:bg-gray-700/20">
                    <td className="px-4 py-3 text-white">{m?.business_name ?? '—'}</td>
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

      {/* Commission distributions */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white">Commissions recues ({commList.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Type', 'Niveau', 'Montant', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {commList.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Aucune commission</td></tr>
              ) : commList.map((c, i) => (
                <tr key={i} className="hover:bg-gray-700/20">
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${
                      c.distribution_type === 'network' ? 'bg-indigo-900/30 text-indigo-300' :
                      c.distribution_type === 'cashback' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-gray-700 text-gray-400'
                    }`}>{c.distribution_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">L{c.level}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">+{formatFcfa(c.amount_fcfa)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
