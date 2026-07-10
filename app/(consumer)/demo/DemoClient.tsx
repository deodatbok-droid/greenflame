'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { useLocale } from '@/components/providers/LocaleProvider'

// Fictional chain — names stay as-is (African demo names)
const FICTIONAL_CHAIN = [
  { tag: 'Vous', name: 'Fèmi K. (cashback)',      role: 'buyer'    as const, share: 0.12 },
  { tag: 'L1',   name: 'Ama BELLO',               role: 'network'  as const, share: 0.12 },
  { tag: 'L2',   name: 'Kofi AGBOSSOU',           role: 'network'  as const, share: 0.10 },
  { tag: 'L3',   name: 'Fatou DIALLO',            role: 'network'  as const, share: 0.08 },
  { tag: 'L4',   name: 'Moussa SABI',             role: 'network'  as const, share: 0.06 },
  { tag: 'L5',   name: 'Binta ALABI',             role: 'network'  as const, share: 0.04 },
  { tag: '🏆',   name: 'Pool Récompenses',        role: 'platform' as const, share: 0.03 },
  { tag: '🔥',   name: 'GreenFlame (plateforme)', role: 'platform' as const, share: 0.45 },
]

interface SimRow  { tag: string; name: string; amount: number; role: 'buyer' | 'network' | 'platform'; share: number }
interface SimItem { id: string; name: string; emoji: string; price: number; rate: number; commission: number; rows: SimRow[] }

export type RealChainMember = { level: string; name: string; id: string | null; share: number }

function rowColor(role: SimRow['role']) {
  if (role === 'buyer')    return { bg: 'bg-brand-50/60',   badge: 'bg-brand-100 text-brand-700',   text: 'text-brand-600'  }
  if (role === 'platform') return { bg: 'bg-gray-50/60',    badge: 'bg-gray-200 text-gray-600',     text: 'text-gray-500'   }
  return                          { bg: '',                  badge: 'bg-green-100 text-green-700',   text: 'text-green-600'  }
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-brand-400 to-orange-400 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

function DemoFooterCTA({ isGuest: _isGuest, registerHref }: { isGuest: boolean; registerHref: string }) {
  const { t } = useLocale()
  return (
    <div className="border-t border-gray-100 pt-5 space-y-3">
      <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">{t('demo.nextStep')}</p>
      <Link
        href={registerHref}
        className="flex items-center justify-between w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-5 rounded-2xl transition-colors"
      >
        <span>{t('demo.joinCommunity')}</span>
        <span className="text-sm font-normal opacity-80">{t('demo.free')}</span>
      </Link>
      <Link
        href="/login"
        className="flex items-center justify-between w-full border-2 border-brand-200 text-brand-700 font-semibold py-3.5 px-5 rounded-2xl hover:bg-brand-50 transition-colors"
      >
        <span>{t('landing.navMyDashboard')}</span>
        <span className="text-sm opacity-60">→</span>
      </Link>
      <Link
        href="/"
        className="block text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        {t('demo.backHome')}
      </Link>
    </div>
  )
}

export default function DemoClient({
  realChain,
  dreamworldMerchantId,
  buyerId,
  isGuest,
  referralCode,
}: {
  realChain: RealChainMember[]
  dreamworldMerchantId: string | null
  buyerId: string
  isGuest: boolean
  referralCode: string | null
}) {
  const { t } = useLocale()

  const DEMO_PRODUCTS = [
    { id: 'eau',      name: t('demo.product1'), emoji: '💧', price: 500,   rate: 0.10 },
    { id: 'riz',      name: t('demo.product2'), emoji: '🌾', price: 5000,  rate: 0.05 },
    { id: 'internet', name: t('demo.product3'), emoji: '📶', price: 20000, rate: 0.03 },
    { id: 'phone',    name: t('demo.product4'), emoji: '📱', price: 80000, rate: 0.10 },
  ]

  const [selected,   setSelected]   = useState<Set<string>>(new Set(['eau']))
  const [simResult,  setSimResult]  = useState<SimItem[] | null>(null)
  const [openCards,  setOpenCards]  = useState<Set<string>>(new Set())
  const [txDone,     setTxDone]     = useState(false)
  const [running,    setRunning]    = useState(false)

  const registerHref = referralCode
    ? `/register?ref=${encodeURIComponent(referralCode)}`
    : '/register'

  function toggleProduct(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) } else next.add(id)
      return next
    })
    setSimResult(null)
    setOpenCards(new Set())
    setTxDone(false)
  }

  function toggleCard(id: string) {
    setOpenCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function simulate() {
    const results: SimItem[] = DEMO_PRODUCTS.filter(p => selected.has(p.id)).map(product => {
      const commission = Math.floor(product.price * product.rate)
      const rows: SimRow[] = FICTIONAL_CHAIN.map(m => ({
        tag:    m.tag,
        name:   m.name,
        amount: Math.floor(commission * m.share),
        role:   m.role,
        share:  m.share,
      }))
      return { ...product, commission, rows }
    })
    setOpenCards(results.length === 1 ? new Set([results[0].id]) : new Set())
    setSimResult(results)
  }

  async function execute() {
    if (!dreamworldMerchantId) {
      setTxDone(true)
      toast.success(t('demo.toastSimOnly'))
      return
    }
    setRunning(true)
    try {
      for (const product of DEMO_PRODUCTS.filter(p => selected.has(p.id))) {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId: dreamworldMerchantId,
            amountFcfa: product.price,
            paymentMethod: 'cash_confirmed',
            idempotencyKey: `demo-${buyerId}-${product.id}-${Date.now()}`,
          }),
        })
      }
      toast.success(t('demo.toastSuccess'))
    } catch {
      toast.error(t('demo.toastError'))
    } finally {
      setRunning(false)
      setTxDone(true)
    }
  }

  const totals: { tag: string; name: string; role: SimRow['role']; total: number }[] =
    simResult
      ? FICTIONAL_CHAIN.map(person => ({
          tag:  person.tag,
          name: person.name,
          role: person.role,
          total: simResult.reduce((s, item) => {
            const row = item.rows.find(r => r.name === person.name)
            return s + (row?.amount ?? 0)
          }, 0),
        }))
      : []

  const grandTotal       = simResult ? simResult.reduce((s, r) => s + r.commission, 0) : 0
  const maxTotal         = Math.max(...totals.map(t => t.total), 1)
  const selectedProducts = DEMO_PRODUCTS.filter(p => selected.has(p.id))
  const totalPanier      = selectedProducts.reduce((s, p) => s + p.price, 0)
  const totalCommission  = selectedProducts.reduce((s, p) => s + Math.floor(p.price * p.rate), 0)
  const multiProduct     = selectedProducts.length > 1

  const cartItemsLabel = t('demo.cartItems').replace('{s}', selectedProducts.length > 1 ? 's' : '')

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-8 space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors"
        >
          {t('demo.home')}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {isGuest ? (
            <>
              <Link
                href="/login"
                className="text-sm text-brand-600 font-medium border border-brand-200 px-3 py-1.5 rounded-xl hover:bg-brand-50 transition-colors"
              >
                {t('common.signIn')}
              </Link>
              <Link
                href={registerHref}
                className="text-sm bg-brand-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors"
              >
                {t('common.signUp')} →
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm bg-brand-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors"
            >
              {t('demo.myDashboard')}
            </Link>
          )}
        </div>
      </div>

      {/* ── DESCRIPTION ── */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 rounded-2xl p-5 text-white">
        <p className="text-brand-200 text-xs font-medium uppercase tracking-wide mb-1">{t('demo.shopName')}</p>
        <h1 className="text-xl font-bold">{t('demo.cycleTitle')}</h1>
        <p className="text-brand-200 text-sm mt-1">{t('demo.cycleSubtitle')}</p>
        {isGuest && (
          <p className="text-brand-300 text-xs mt-2 border-t border-white/10 pt-2">
            {t('demo.guestNote')}
          </p>
        )}
      </div>

      {/* ── 1. SÉLECTION PRODUITS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="font-semibold text-gray-900">{t('demo.step1')}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_PRODUCTS.map(p => (
            <button
              key={p.id}
              onClick={() => toggleProduct(p.id)}
              className={`relative flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                selected.has(p.id)
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-brand-300 bg-white'
              }`}
            >
              <span className="text-2xl flex-shrink-0">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-gray-900 leading-tight">{p.name}</p>
                <p className="text-brand-600 font-bold text-sm mt-0.5">{formatFcfa(p.price)} F</p>
                <p className="text-xs text-gray-400">{(p.rate * 100).toFixed(0)}{t('demo.commission')}</p>
              </div>
              {selected.has(p.id) && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">{selectedProducts.length} {cartItemsLabel}</span>
            <span className="font-bold text-gray-900">{formatFcfa(totalPanier)} FCFA</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">{t('demo.cartCommissions')}</span>
            <span className="text-brand-600 font-semibold text-xs">{formatFcfa(totalCommission)} FCFA</span>
          </div>
        </div>
      </div>

      {/* ── BOUTON SIMULER ── */}
      <button
        onClick={simulate}
        disabled={totalCommission === 0}
        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors text-base"
      >
        {t('demo.simulate')}
      </button>

      {/* ── RÉSULTATS DE SIMULATION ── */}
      {simResult && !txDone && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
            2. Distribution — {multiProduct ? t('demo.step2Multi') : t('demo.step2Single')}
          </p>

          {/* Accordéon par article */}
          {simResult.map(r => {
            const isOpen = openCards.has(r.id)
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleCard(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl flex-shrink-0">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatFcfa(r.price)} FCFA · {(r.rate * 100).toFixed(0)}% →{' '}
                      <span className="font-medium text-gray-600">{formatFcfa(r.commission)} {t('demo.toDistribute')}</span>
                    </p>
                  </div>
                  {!isOpen && (
                    <div className="hidden sm:flex gap-1 items-end h-5 mr-2">
                      {r.rows.map((row, j) => {
                        const maxAmt = Math.max(...r.rows.map(x => x.amount), 1)
                        const h = Math.round((row.amount / maxAmt) * 16) + 4
                        const col = row.role === 'buyer' ? 'bg-brand-400' : row.role === 'platform' ? 'bg-gray-400' : 'bg-green-400'
                        return <div key={j} className={`w-1.5 rounded-t ${col}`} style={{ height: `${h}px` }} />
                      })}
                    </div>
                  )}
                  <span className={`text-gray-300 text-lg transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {r.rows.map((row, j) => {
                      const c = rowColor(row.role)
                      return (
                        <div key={j} className={`flex items-center gap-3 px-4 py-3 ${c.bg}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.badge}`}>
                            {row.tag}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 font-medium truncate">{row.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Bar value={row.amount} max={Math.max(...r.rows.map(x => x.amount), 1)} />
                              <span className="text-xs text-gray-400 flex-shrink-0">{(row.share * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <p className={`font-bold text-sm flex-shrink-0 ${c.text}`}>+{formatFcfa(row.amount)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Récapitulatif global */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <p className="font-bold text-white">
                {multiProduct
                  ? t('demo.summaryMulti').replace('{n}', String(selectedProducts.length))
                  : t('demo.summaryTitle')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('demo.summarySubtitle').replace('{n}', formatFcfa(grandTotal))}
              </p>
            </div>
            <div className="divide-y divide-gray-700/50">
              {totals.map((tot, i) => {
                const c = rowColor(tot.role)
                const pct = (FICTIONAL_CHAIN[i]?.share ?? 0) * 100
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.badge}`}>
                      {tot.tag}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm text-gray-200 font-medium truncate">{tot.name}</p>
                      <div className="flex items-center gap-2">
                        <Bar value={tot.total} max={maxTotal} />
                        <span className="text-xs text-gray-500 flex-shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className={`font-bold text-sm flex-shrink-0 ${c.text}`}>+{formatFcfa(tot.total)}</p>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-4 bg-gray-700/30 flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                {t('demo.totalCommissions')}
                {multiProduct && <span className="text-gray-500 text-xs ml-1">({selectedProducts.length} {t('demo.step2Multi').split(' ')[0]})</span>}
              </p>
              <p className="text-white text-lg font-bold">{formatFcfa(grandTotal)} FCFA</p>
            </div>
          </div>

          {/* ── CTA exécution (connecté uniquement, avant tx) ── */}
          {!isGuest && !txDone && (
            <div className="text-center pt-1">
              <p className="text-xs text-gray-500 mb-3">{t('demo.executeHint')}</p>
              <button
                onClick={execute}
                disabled={running}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all text-base shadow-lg shadow-orange-200"
              >
                {running ? t('demo.running') : t('demo.execute')}
              </button>
            </div>
          )}

          <DemoFooterCTA isGuest={isGuest} registerHref={registerHref} />
        </div>
      )}

      {/* ── POST-EXÉCUTION ── */}
      {txDone && !isGuest && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-green-700 text-xl">{t('demo.confirmed')}</p>
            <p className="text-sm text-green-600 mt-1.5">{t('demo.confirmedDesc')}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <p className="font-semibold text-gray-900">{t('demo.myChain')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('demo.myChainDesc')}</p>
            </div>
            <div className="space-y-1.5">
              {realChain.map((m, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                  i === 0 ? 'bg-brand-50 border border-brand-100' :
                  m.id    ? 'bg-gray-50' : 'opacity-40 bg-gray-50'
                }`}>
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-700">{i === 0 ? 'V' : m.level}</span>
                  </div>
                  <p className={`text-sm flex-1 ${m.id ? 'text-gray-800 font-medium' : 'text-gray-400 italic'}`}>
                    {m.name}
                  </p>
                  <p className="text-xs text-gray-400">{(m.share * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
            {realChain.some(m => m.id === null) && (
              <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                {t('demo.spillover')}{' '}
                <span className="font-semibold">{t('demo.spilloverCta')}</span>
              </div>
            )}
          </div>

          <DemoFooterCTA isGuest={isGuest} registerHref={registerHref} />
        </div>
      )}
    </div>
  )
}
