'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { formatFcfa, formatExactAmount, commissionCode } from '@/lib/utils/format'
import MerchantTransactionsFeed from '@/components/merchant/MerchantTransactionsFeed'
import { UpgradeBanner } from '@/components/merchant/ProGate'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'
import { useTrack } from '@/lib/hooks/useTrack'

interface Buyer {
  buyerId: string
  name: string
  purchaseCount: number
  totalGenerated: number
}

interface Props {
  merchant: {
    id: string
    business_name: string
    business_category: string
    is_verified: boolean
    commission_rate: number
    total_gmv: number
    qr_code_url: string | null
    subscription_tier: string
    subscription_expires_at: string | null
    agent_service_active: boolean
    is_platform_hub?: boolean
  }
  /** Wallet boutique : revenus de ventes + float agent */
  merchantWallet: { balance_fcfa: number; total_earned_fcfa: number } | null
  /** Wallet perso : cashback + commissions réseau + GFP */
  personalWallet: { balance_fcfa: number; balance_gfp: number } | null
  monthStats: { count: number; gmv: number; commission: number; netRevenue: number }
  todayStats: { count: number; gmv: number; commission: number }
  recentBuyers: Buyer[]
  referralUrl: string
  merchantUserId: string
  isAdmin?: boolean
  /** Ventilation all-time par méthode de paiement (montants bruts) */
  revenueByMethod: { cash: number; walletGf: number; momo: number }
}

export default function MerchantDashboardClient({
  merchant, merchantWallet, personalWallet, monthStats, todayStats, recentBuyers, referralUrl, merchantUserId, isAdmin, revenueByMethod,
}: Props) {
  const { t, locale } = useLocale()
  const track = useTrack()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'commandes' | 'rapport' | 'communaute' | 'qrcode'>('dashboard')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(merchant.qr_code_url)

  // ── Rapport P&L ──
  interface PnlMonth {
    month: string; ca: number; commission: number; net: number; count: number
    byMethod: Record<string, number>
  }
  const [pnlMonths, setPnlMonths]     = useState<PnlMonth[]>([])
  const [pnlLoading, setPnlLoading]   = useState(false)
  const [pnlFetched, setPnlFetched]   = useState(false)
  const [pnlTotals, setPnlTotals]     = useState<{ ca: number; commission: number; net: number } | null>(null)
  const [pnlRate, setPnlRate]         = useState(merchant.commission_rate)
  const [qrSaving, setQrSaving] = useState(false)
  const qrGeneratedRef = useRef(false)
  const [copied, setCopied] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawOperator, setWithdrawOperator] = useState<'mtn_momo' | 'moov_money'>('mtn_momo')
  const [withdrawPhone, setWithdrawPhone] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  // Tracking page vue marchand
  useEffect(() => { track('page_viewed', { page: 'merchant_dashboard' }) }, []) // eslint-disable-line

  // Charge les données P&L à l'ouverture de l'onglet rapport
  useEffect(() => {
    if (activeTab !== 'rapport' || pnlFetched) return
    setPnlLoading(true)
    fetch('/api/merchant/pnl')
      .then(r => r.json())
      .then(d => {
        if (d.months) { setPnlMonths(d.months); setPnlTotals(d.totals); setPnlRate(d.commissionRate) }
      })
      .catch(() => {})
      .finally(() => { setPnlLoading(false); setPnlFetched(true) })
  }, [activeTab, pnlFetched])

  // Génère le QR code côté client dès l'ouverture de l'onglet
  useEffect(() => {
    if (activeTab !== 'qrcode' || qrGeneratedRef.current) return
    qrGeneratedRef.current = true
    const qrData = `greenflame://pay?merchant_id=${merchant.id}&v=1`
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        width: 400,
        margin: 2,
        color: { dark: '#166534', light: '#FFFFFF' },
      }).then(url => setQrDataUrl(url))
    }).catch(() => {})
  }, [activeTab, merchant.id])

  async function handleSaveQr() {
    if (!qrDataUrl) return
    setQrSaving(true)
    try {
      const res = await fetch('/api/merchant/qr-regenerate', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.qrCodeUrl) setQrDataUrl(data.qrCodeUrl)
      else toast.error(t('merchantDash.qrSaveError'))
    } finally {
      setQrSaving(false)
    }
  }

  function downloadQR() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `GreenFlame-QR-${merchant.business_name}.png`
    link.click()
  }

  async function handleWithdraw() {
    const amount = parseInt(withdrawAmount.replace(/\D/g, ''))
    if (!amount || amount < 1000) { toast.error(t('merchantDash.withdrawMinError')); return }
    if (!withdrawPhone.trim()) { toast.error(t('merchantDash.withdrawPhoneError')); return }
    setWithdrawBusy(true)
    const res = await fetch('/api/merchant/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, operator: withdrawOperator, phone: withdrawPhone }),
    })
    const data = await res.json()
    setWithdrawBusy(false)
    if (!res.ok) { toast.error(data.error ?? t('merchantDash.withdrawError')); return }
    toast.success(t('merchantDash.withdrawSuccess'))
    setShowWithdraw(false)
    setWithdrawAmount('')
    setWithdrawPhone('')
  }

  const rate      = merchant.commission_rate
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
  const moisLabel = new Date().toLocaleString(dateLocale, { month: 'long' })
  const isHub     = merchant.is_platform_hub ?? false
  const isPro     = true  // Standard features free for all merchants
  const isVip     = isHub || ['vip'].includes(merchant.subscription_tier)
  const isAgent   = isHub || merchant.agent_service_active

  const fmtPct = (v: number) => (v * 100).toLocaleString(dateLocale, { maximumFractionDigits: 4 }) + '%'
  const code = commissionCode(rate)
  const breakdown = [
    { label: t('merchantDash.breakdownPlatform'), value: monthStats.commission * 0.45, color: 'bg-brand-700 text-white' },
    { label: t('merchantDash.breakdownCashback'), value: monthStats.commission * 0.15, color: 'bg-brand-100 text-brand-800' },
    { label: t('merchantDash.breakdownCommunity'), value: monthStats.commission * 0.40, color: 'bg-green-50 text-green-800 border border-green-200' },
  ]

  function handleShare() {
    navigator.clipboard?.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const TABS = [
    { id: 'dashboard',  label: t('merchantDash.tabDashboard') },
    { id: 'commandes',  label: t('merchantDash.tabOrders') },
    { id: 'rapport',    label: t('merchantDash.tabPnl') },
    { id: 'communaute', label: t('merchantDash.tabCommunity') },
    { id: 'qrcode',     label: t('merchantDash.tabQr') },
  ] as const

  const methodLabels: Record<string, string> = {
    wallet_gf:      '🔥 Wallet',
    mtn_momo:       '📱 MTN',
    moov_money:     '💚 Moov',
    cash_confirmed: locale === 'en' ? '💵 Cash' : '💵 Espèces',
    celtiis:        '🟠 Orange',
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={48} className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 text-sm">{merchant.business_name}</span>
                {merchant.is_verified && (
                  <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                    {t('merchantDash.verified')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{merchant.business_category}</p>
            </div>
          </div>
          <Link
            href="/merchant/receive"
            className="bg-brand-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            {t('merchantDash.newPayment')}
          </Link>
        </div>

        {/* Onglets */}
        <div className="relative max-w-4xl mx-auto border-t border-gray-50 after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:pointer-events-none">
          <div className="flex gap-1 sm:gap-4 px-4 overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm py-3 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 px-1 ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-700 font-medium'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="md:grid md:grid-cols-[1fr_220px] md:gap-5 md:items-start">

          {/* Colonne principale */}
          <div className="space-y-4">

            {/* Raccourcis outils — barre mobile uniquement */}
            <div className="md:hidden grid grid-cols-4 gap-2">
              <Link href="/merchant/receive">
                <div className="bg-brand-600 text-white rounded-xl p-3 text-center cursor-pointer active:bg-brand-700">
                  <span className="text-xl">💳</span>
                  <p className="text-[10px] font-semibold mt-1 leading-tight">{t('merchantDash.toolCollect')}</p>
                </div>
              </Link>
              <Link href="/merchant/tools/devis">
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center cursor-pointer hover:border-brand-200 transition-colors">
                  <span className="text-xl">📄</span>
                  <p className="text-[10px] font-medium mt-1 text-gray-700 leading-tight">{t('merchantDash.toolQuote')}</p>
                </div>
              </Link>
              <Link href="/merchant/tools/facture">
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center cursor-pointer hover:border-brand-200 transition-colors">
                  <span className="text-xl">🧾</span>
                  <p className="text-[10px] font-medium mt-1 text-gray-700 leading-tight">{t('merchantDash.toolInvoice')}</p>
                </div>
              </Link>
              <Link href="/merchant/tools">
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center cursor-pointer hover:border-brand-200 transition-colors">
                  <span className="text-xl">🛠️</span>
                  <p className="text-[10px] font-medium mt-1 text-gray-700 leading-tight">{t('merchantDash.toolTools')}</p>
                </div>
              </Link>
            </div>

            {/* Banner upgrade pour les free */}
            <UpgradeBanner tier={merchant.subscription_tier as 'free' | 'pro' | 'vip'} />

            {/* ── WALLET BOUTIQUE (solde professionnel) ── */}
            <div className="bg-brand-700 rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-brand-200 text-xs mb-0.5">{t('merchantDash.walletBalance')}</p>
                  <p className="text-3xl font-bold">
                    {merchantWallet ? formatFcfa(merchantWallet.balance_fcfa) : '—'}{' '}
                    <span className="text-lg font-medium">FCFA</span>
                  </p>
                </div>
                {merchantWallet && merchantWallet.balance_fcfa >= 1000 && (
                  <button
                    onClick={() => setShowWithdraw(v => !v)}
                    className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {t('merchantDash.walletWithdraw')}
                  </button>
                )}
              </div>

              {/* Ventilation all-time */}
              {merchant.total_gmv > 0 && (
                <div className="mt-4 border-t border-white/20 pt-4 space-y-1.5">
                  <p className="text-brand-200 text-xs font-medium mb-2">
                    {t('merchantDash.walletVolume')} {formatFcfa(merchant.total_gmv)} FCFA
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/10 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-brand-300 mb-0.5">💵 {locale === 'en' ? 'Cash' : 'Espèces'}</p>
                      <p className="text-sm font-bold">{formatFcfa(revenueByMethod.cash)}</p>
                      <p className="text-[9px] text-brand-400 mt-0.5">{t('merchantDash.walletCashPhysical')}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-brand-300 mb-0.5">🔥 Wallet GF</p>
                      <p className="text-sm font-bold">{formatFcfa(revenueByMethod.walletGf)}</p>
                      <p className="text-[9px] text-brand-400 mt-0.5">{t('merchantDash.walletNetWallet')}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-brand-300 mb-0.5">📱 Mobile Money</p>
                      <p className="text-sm font-bold">{formatFcfa(revenueByMethod.momo)}</p>
                      <p className="text-[9px] text-brand-400 mt-0.5">{t('merchantDash.walletNetWallet')}</p>
                    </div>
                  </div>
                  {revenueByMethod.cash > 0 && (
                    <p className="text-brand-400 text-[10px] mt-1 italic">
                      {t('merchantDash.walletCashNote')}
                    </p>
                  )}
                </div>
              )}

              {/* Formulaire de retrait inline */}
              {showWithdraw && (
                <div className="mt-4 bg-white/10 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-brand-200 font-medium">{t('merchantDash.withdrawTitle')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setWithdrawOperator('mtn_momo')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${withdrawOperator === 'mtn_momo' ? 'bg-amber-400 text-amber-900' : 'bg-white/10 text-white'}`}
                    >
                      MTN MoMo
                    </button>
                    <button
                      onClick={() => setWithdrawOperator('moov_money')}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors ${withdrawOperator === 'moov_money' ? 'bg-blue-400 text-blue-900' : 'bg-white/10 text-white'}`}
                    >
                      Moov Flooz
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t('merchantDash.withdrawAmount')}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/20 text-white placeholder-brand-300 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white/30"
                    inputMode="numeric"
                  />
                  <PhoneInput
                    value={withdrawPhone}
                    onChange={setWithdrawPhone}
                    placeholder="97 00 00 00"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawBusy}
                      className="flex-1 bg-white text-brand-700 font-bold py-2.5 rounded-xl text-sm hover:bg-brand-50 transition-colors disabled:opacity-50"
                    >
                      {withdrawBusy ? t('merchantDash.withdrawSending') : t('merchantDash.withdrawRequest')}
                    </button>
                    <button
                      onClick={() => setShowWithdraw(false)}
                      className="px-3 bg-white/10 text-white rounded-xl text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-brand-300 text-center">
                    {t('merchantDash.withdrawNote')}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Link href="/merchant/receive" className="flex-1">
                  <button className="w-full bg-white text-brand-700 font-bold py-2.5 rounded-xl text-sm hover:bg-brand-50 transition-colors">
                    {t('merchantDash.receivePayment')}
                  </button>
                </Link>
                {merchant.agent_service_active ? (
                  <Link href="/merchant/agent" className="flex-1">
                    <button className="w-full bg-amber-400 hover:bg-amber-300 text-amber-900 font-bold py-2.5 rounded-xl text-sm transition-colors">
                      🏦 {t('merchantDash.toolAgent')}
                    </button>
                  </Link>
                ) : (
                  <Link href="/merchant/history" className="flex-1">
                    <button className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                      {t('merchantDash.historyBtn')}
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* ── WALLET PERSO (cashback + commissions réseau) ── */}
            {personalWallet && (personalWallet.balance_fcfa > 0 || personalWallet.balance_gfp > 0) && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t('merchantDash.personalAccount')}</p>
                    <p className="text-sm font-semibold text-gray-500">{t('merchantDash.personalSubtitle')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatFcfa(personalWallet.balance_fcfa)} <span className="text-xs font-normal text-gray-400">FCFA</span></p>
                    {personalWallet.balance_gfp > 0 && (
                      <p className="text-xs text-brand-600">{personalWallet.balance_gfp.toLocaleString()} GFP</p>
                    )}
                  </div>
                </div>
                <Link href="/wallet" className="mt-3 block text-center text-xs text-brand-600 hover:text-brand-700 font-medium">
                  {t('merchantDash.personalLink')}
                </Link>
              </div>
            )}

            {/* Stats du mois */}
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2 capitalize">{moisLabel}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t('merchantDash.statSalesMonth'), value: String(monthStats.count), sub: t('merchantDash.statTransactions') },
                  { label: t('merchantDash.statGmv'), value: formatFcfa(monthStats.gmv), sub: t('merchantDash.statGmvSub') },
                  { label: t('merchantDash.statFees').replace('{code}', code), value: formatFcfa(monthStats.commission), sub: t('merchantDash.statFeesSub') },
                  { label: t('merchantDash.statNet'), value: formatFcfa(monthStats.netRevenue), sub: t('merchantDash.statNetSub') },
                ].map(s => (
                  <Link key={s.label} href="/merchant/history" className="bg-white rounded-xl p-4 border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all block">
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-tight">{s.label}</p>
                    <p className="text-xs text-brand-600 mt-1">{s.sub}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Stats aujourd'hui */}
            {todayStats.count > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{t('merchantDash.today')}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-2xl font-bold text-gray-900">{todayStats.count}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('merchantDash.todayTransactions')}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-lg font-bold text-gray-900">{formatFcfa(todayStats.gmv)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('merchantDash.todaySales')}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-lg font-bold text-brand-600">{formatFcfa(todayStats.commission)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('merchantDash.todayFees')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Répartition des frais */}
            {monthStats.commission > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-1">
                  {t('merchantDash.breakdownTitle').replace('{amount}', formatFcfa(monthStats.commission))}
                </h2>
                <p className="text-xs text-gray-400 mb-4">{t('merchantDash.breakdownSubtitle')}</p>
                <div className="flex flex-wrap gap-3">
                  {breakdown.map(c => (
                    <div key={c.label} className={`${c.color} rounded-xl px-4 py-3.5 flex-1 min-w-[140px] text-center`}>
                      <p className="text-xl font-bold">{formatExactAmount(c.value)}</p>
                      <p className="text-xs mt-1 opacity-80">{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partage boutique */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-brand-900 mb-1">{t('merchantDash.shareTitle')}</h3>
                  <p className="text-sm text-brand-700">{t('merchantDash.shareSubtitle')}</p>
                </div>
                <button
                  onClick={handleShare}
                  className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors self-start flex-shrink-0"
                >
                  {copied ? t('merchantDash.shareCopied') : t('merchantDash.shareCopy')}
                </button>
              </div>
            </div>

          </div>{/* /colonne principale */}

          {/* ── Bande latérale outils — desktop uniquement ── */}
          <div className="hidden md:flex flex-col gap-3 sticky top-20">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('merchantDash.toolTools')}</p>
              <div className="space-y-0.5">
                <Link href="/merchant/receive">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors cursor-pointer mb-1.5">
                    <span className="text-sm">💳</span>
                    <span className="text-xs font-bold text-white">{t('merchantDash.toolCollect')}</span>
                  </div>
                </Link>
                <Link href="/merchant/tools/devis">
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <span className="text-sm">📄</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 leading-tight">{t('merchantDash.toolQuote')}</p>
                      <p className="text-[10px] text-gray-400">{isPro ? t('merchantDash.toolUnlimited') : t('merchantDash.toolMonthly')}</p>
                    </div>
                  </div>
                </Link>
                <Link href="/merchant/tools/facture">
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <span className="text-sm">🧾</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 leading-tight">{t('merchantDash.toolInvoice')}</p>
                      <p className="text-[10px] text-gray-400">{isPro ? t('merchantDash.toolUnlimited') : t('merchantDash.toolMonthly')}</p>
                    </div>
                  </div>
                </Link>
                {isPro && (
                  <Link href="/merchant/analytics">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <span className="text-sm">📊</span>
                      <p className="text-xs font-medium text-gray-700">{t('merchantDash.toolAnalytics')}</p>
                    </div>
                  </Link>
                )}
                {isVip && (
                  <Link href="/merchant/cashiers">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer">
                      <span className="text-sm">👥</span>
                      <p className="text-xs font-medium text-amber-700">{t('merchantDash.toolCashiers')}</p>
                    </div>
                  </Link>
                )}
                {isAgent && (
                  <Link href="/merchant/agent">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
                      <span className="text-sm">🏦</span>
                      <p className="text-xs font-medium text-blue-700">{t('merchantDash.toolAgent')}</p>
                    </div>
                  </Link>
                )}
                <div className="border-t border-gray-100 mt-1.5 pt-1.5">
                  <Link href="/merchant/tools">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <span className="text-sm">🛠️</span>
                      <p className="text-xs font-medium text-brand-600">{t('merchantDash.toolAllTools')}</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          </div>
        )}

        {/* ── COMMANDES ── */}
        {activeTab === 'commandes' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('merchantDash.ordersRealtime')}</p>
            <MerchantTransactionsFeed merchantUserId={merchantUserId} />
          </div>
        )}

        {/* ── RAPPORT P&L ── */}
        {activeTab === 'rapport' && (
          <div className="space-y-4">

            {/* Résumé all-time */}
            {pnlTotals && (
              <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl p-5 text-white">
                <p className="text-brand-200 text-xs font-medium uppercase tracking-wide mb-3">{t('merchantDash.pnlAllTime')}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-brand-300 text-xs">{t('merchantDash.pnlGross')}</p>
                    <p className="font-bold text-lg leading-tight">{formatFcfa(pnlTotals.ca)}</p>
                    <p className="text-brand-300 text-xs">FCFA</p>
                  </div>
                  <div>
                    <p className="text-brand-300 text-xs">{t('merchantDash.pnlFees')}</p>
                    <p className="font-bold text-lg leading-tight text-red-300">{formatFcfa(pnlTotals.commission)}</p>
                    <p className="text-brand-300 text-xs">FCFA</p>
                  </div>
                  <div>
                    <p className="text-brand-300 text-xs">{t('merchantDash.pnlNet')}</p>
                    <p className="font-bold text-lg leading-tight text-green-300">{formatFcfa(pnlTotals.net)}</p>
                    <p className="text-brand-300 text-xs">FCFA</p>
                  </div>
                </div>
                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-brand-200 text-xs">{t('merchantDash.pnlCode')}</span>
                  <span className="text-white font-bold text-sm">{commissionCode(pnlRate)}</span>
                </div>
              </div>
            )}

            {/* Tableau mensuel */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{t('merchantDash.pnlMonthlyTitle')}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('merchantDash.pnlMonthlySubtitle')}</p>
                </div>
                <span className="text-xs bg-brand-50 text-brand-700 font-medium px-2.5 py-1 rounded-full">
                  {t('merchantDash.pnlMonths').replace('{n}', String(pnlMonths.length))}
                </span>
              </div>

              {pnlLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : pnlMonths.length === 0 ? (
                <div className="text-center py-14">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="font-semibold text-gray-600">{t('merchantDash.pnlNoSales')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('merchantDash.pnlNoSalesSub')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pnlMonths.map((m) => {
                    const date     = new Date(`${m.month}-01`)
                    const label    = date.toLocaleString(dateLocale, { month: 'long', year: 'numeric' })
                    const netRatio = m.ca > 0 ? Math.round((m.net / m.ca) * 100) : 0
                    const methods  = Object.entries(m.byMethod)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)

                    return (
                      <div key={m.month} className="px-5 py-4">
                        {/* En-tête mois */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 capitalize text-sm">{label}</p>
                            <p className="text-xs text-gray-400">
                              {(m.count > 1
                                ? t('merchantDash.pnlSales')
                                : t('merchantDash.pnlSale')
                              ).replace('{n}', String(m.count))}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand-700">{formatFcfa(m.net)} <span className="text-xs font-normal text-gray-400">{t('merchantDash.pnlNetLabel')}</span></p>
                            <p className="text-xs text-gray-400">{t('merchantDash.pnlRetained').replace('{pct}', String(netRatio))}</p>
                          </div>
                        </div>

                        {/* Barre de répartition */}
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3 flex">
                          <div className="h-full bg-green-400 rounded-l-full" style={{ width: `${netRatio}%` }} />
                          <div className="h-full bg-red-300" style={{ width: `${100 - netRatio}%` }} />
                        </div>

                        {/* Chiffres */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-gray-400">{t('merchantDash.pnlGross')}</p>
                            <p className="font-semibold text-gray-900">{formatFcfa(m.ca)}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2 text-center">
                            <p className="text-red-400">{t('merchantDash.pnlFees')}</p>
                            <p className="font-semibold text-red-600">-{formatFcfa(m.commission)}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <p className="text-green-600">{t('merchantDash.pnlNetDisplay')}</p>
                            <p className="font-semibold text-green-700">+{formatFcfa(m.net)}</p>
                          </div>
                        </div>

                        {/* Méthodes top */}
                        {methods.length > 0 && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {methods.map(([method, amt]) => (
                              <span key={method} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                                {methodLabels[method] ?? method} · {formatFcfa(amt)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Bouton relevé PDF (Pro/VIP uniquement) */}
                        {isPro && m.count > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-50">
                            <a
                              href={`/merchant/statement?month=${m.month}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium hover:underline transition-colors"
                            >
                              📄 Relevé PDF — {label}
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Légende */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
              <p className="font-medium mb-1">{t('merchantDash.pnlLegendTitle')}</p>
              <p>{t('merchantDash.pnlLegendBody').replace('{code}', commissionCode(pnlRate))}</p>
            </div>
          </div>
        )}

        {/* ── MA COMMUNAUTÉ ── */}
        {activeTab === 'communaute' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-1">{t('merchantDash.communityTitle')}</h2>
              <p className="text-sm text-gray-400 mb-4">{t('merchantDash.communitySubtitle')}</p>

              {recentBuyers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">🌱</p>
                  <p className="font-medium text-gray-600">{t('merchantDash.communityEmpty')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('merchantDash.communityEmptySub')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentBuyers.map(buyer => (
                    <div key={buyer.buyerId} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-xs font-semibold text-brand-700 flex-shrink-0">
                          {buyer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{buyer.name}</p>
                          <p className="text-xs text-gray-400">
                            {(buyer.purchaseCount > 1
                              ? t('merchantDash.communityPurchases')
                              : t('merchantDash.communityPurchase')
                            ).replace('{n}', String(buyer.purchaseCount))}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-brand-700">
                          +{formatFcfa(buyer.totalGenerated)} F
                        </p>
                        <p className="text-xs text-gray-400">{t('merchantDash.communityGenerated')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-800 font-medium mb-1">{t('merchantDash.communityGrowTitle')}</p>
              <p className="text-xs text-green-600 mb-3">{t('merchantDash.communityGrowSubtitle')}</p>
              <button
                onClick={handleShare}
                className="bg-brand-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-brand-700 transition-colors"
              >
                {copied ? t('merchantDash.communityCopied') : t('merchantDash.communityCopy')}
              </button>
            </div>
          </div>
        )}

        {/* ── QR CODE ── */}
        {activeTab === 'qrcode' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-4">{t('merchantDash.qrTitle')}</p>

              {qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR Code marchand"
                    className="w-56 h-56 mx-auto rounded-xl border-4 border-brand-100 shadow-sm"
                  />
                  <p className="text-xs text-gray-400 mt-3">{t('merchantDash.qrInstruction')}</p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={downloadQR}
                      className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                    >
                      {t('merchantDash.qrDownload')}
                    </button>
                    {!merchant.qr_code_url && (
                      <button
                        onClick={handleSaveQr}
                        disabled={qrSaving}
                        className="flex-1 bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors text-sm"
                      >
                        {qrSaving ? t('merchantDash.qrSaving') : t('merchantDash.qrSave')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{t('merchantDash.qrGenerating')}</p>
                </div>
              )}
            </div>

            <Link href="/merchant/receive">
              <button className="w-full bg-flame-500 hover:bg-flame-600 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {t('merchantDash.qrReceivePayment')}
              </button>
            </Link>
          </div>
        )}

      </div>

      {/* ── TOAST COPY ── */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {t('merchantDash.shareToast')}
        </div>
      )}
    </div>
  )
}
