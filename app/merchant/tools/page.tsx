import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import { getServerT } from '@/lib/i18n/server'

export default async function MerchantToolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, commission_rate, total_gmv, subscription_tier, subscription_expires_at, public_slug, agent_service_active, is_platform_hub, sector, sector_activated_at')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const { t, locale } = await getServerT()
  const localeCode = locale === 'en' ? 'en-US' : 'fr-FR'

  const isHub = merchant.is_platform_hub ?? false

  const { data: toolSubsData } = await supabase
    .from('tool_subscriptions')
    .select('tool_slug, expires_at')
    .eq('merchant_id', merchant.id)
    .in('tool_slug', ['salon', 'couture', 'btp', 'resto'])

  const toolActive: Record<string, boolean> = {}
  const toolExpiry: Record<string, string | null> = {}
  for (const slug of ['salon', 'couture', 'btp', 'resto']) {
    const sub = toolSubsData?.find((s) => s.tool_slug === slug)
    toolActive[slug] = isHub || (sub ? new Date(sub.expires_at) > new Date() : false)
    toolExpiry[slug] = sub?.expires_at ?? null
  }

  function fmtExpiry(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString(localeCode, { day: '2-digit', month: 'short' })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())

  const [monthRes, weekRes, allTimeRes] = await Promise.all([
    supabase.from('transactions')
      .select('amount_fcfa, commission_total, created_at')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString()),
    supabase.from('transactions')
      .select('amount_fcfa, commission_total')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .gte('created_at', startOfWeek.toISOString()),
    supabase.from('transactions')
      .select('amount_fcfa, commission_total, created_at, buyers:buyer_id(full_name)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const monthTxs = monthRes.data ?? []
  const weekTxs = weekRes.data ?? []
  const allTxs = allTimeRes.data ?? []

  const monthGmv = monthTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const monthNet = monthTxs.reduce((s, t) => s + (t.amount_fcfa - t.commission_total), 0)
  const monthCommission = monthTxs.reduce((s, t) => s + t.commission_total, 0)
  const weekGmv = weekTxs.reduce((s, t) => s + t.amount_fcfa, 0)

  const dailyMap: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const tx of allTxs) {
    const day = tx.created_at.slice(0, 10)
    if (day in dailyMap) dailyMap[day] = (dailyMap[day] ?? 0) + tx.amount_fcfa
  }
  const dailyData = Object.entries(dailyMap).map(([date, gmv]) => ({
    label: new Date(date).toLocaleDateString(localeCode, { weekday: 'short', day: 'numeric' }),
    gmv,
  }))
  const maxGmv = Math.max(...dailyData.map(d => d.gmv), 1)

  const SECTOR_LABELS: Record<string, { label: string; icon: string }> = {
    consultant:   { label: 'Consultant / Solopreneur', icon: '💼' },
    avocat:       { label: 'Avocat / Juriste',          icon: '⚖️' },
    photographe:  { label: 'Photographe / Vidéaste',    icon: '📸' },
    transporteur: { label: 'Transport / Livraison',     icon: '🚛' },
    medecin:      { label: 'Médecin / Clinique',        icon: '🏥' },
    coach:        { label: 'Coach / Formateur',         icon: '🎯' },
    evenement:    { label: 'Événementiel / Déco',       icon: '🎉' },
    imprimerie:   { label: 'Imprimerie / Comm visuelle',icon: '🖨️' },
    autre:        { label: 'Autre activité',            icon: '✨' },
  }

  const tier = merchant.subscription_tier ?? 'free'
  const expires = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  // Standard features (ex-Pro) sont gratuits pour tous les marchands
  const isPro  = true
  const isVip  = isHub || (tier === 'vip' && expires !== null && expires > new Date())
  const isAgent = isHub || (merchant.agent_service_active === true && isVip)

  const vipExpiresLabel = expires
    ? expires.toLocaleDateString(localeCode, { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('merchant.tools.toolsTitle')}</h1>
        <Link href="/merchant/dashboard" className="text-brand-600 text-sm">
          {t('merchant.tools.backToDashboard')}
        </Link>
      </div>

      {/* ── OUTILS EN PREMIER ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Devis */}
        <Link href="/merchant/tools/devis">
          <div className="card text-center py-5 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">📄</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.devisDesc')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {isPro ? t('merchant.tools.devisSubUnlimited') : t('merchant.tools.devisSubFree')}
            </p>
          </div>
        </Link>

        {/* Facture */}
        <Link href="/merchant/tools/facture">
          <div className="card text-center py-5 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">🧾</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.factureDesc')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {isPro ? t('merchant.tools.factureSubUnlimited') : t('merchant.tools.factureSubFree')}
            </p>
          </div>
        </Link>

        {/* Encaisser */}
        <Link href="/merchant/receive">
          <div className="card text-center py-5 hover:border-brand-300 transition-colors cursor-pointer border-brand-100 bg-brand-50">
            <span className="text-3xl">💳</span>
            <p className="font-semibold text-brand-700 mt-2 text-sm">{t('merchant.tools.receiveTitle')}</p>
            <p className="text-xs text-brand-400 mt-1">{t('merchant.tools.receiveDesc')}</p>
          </div>
        </Link>

        {/* Analytics */}
        <Link href="/merchant/analytics">
          <div className="card text-center py-5 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">📊</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.analyticsTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('merchant.tools.analyticsDesc')}</p>
          </div>
        </Link>

        <Link href="/merchant/tools/voice">
          <div className="card text-center py-5 hover:border-brand-300 transition-colors cursor-pointer border-dashed">
            <span className="text-3xl">🎤</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.voiceTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('merchant.tools.voiceDesc')}</p>
          </div>
        </Link>

        {/* VIP : Vitrine publique */}
        {isVip && merchant.public_slug ? (
          <div className="card text-center py-5 border-amber-200 bg-amber-50">
            <span className="text-3xl">🏪</span>
            <p className="font-semibold text-amber-800 mt-2 text-sm">{t('merchant.tools.storefrontTitle')}</p>
            <div className="flex gap-1 justify-center mt-2">
              <a
                href={`/boutique/${merchant.public_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] bg-amber-600 text-white px-2 py-1 rounded-lg font-medium"
              >
                {t('merchant.tools.storefrontOpen')}
              </a>
            </div>
            <p className="text-[10px] text-amber-600 mt-1">/boutique/{merchant.public_slug}</p>
          </div>
        ) : isVip && !merchant.public_slug ? (
          <div className="card text-center py-5 border-amber-200 bg-amber-50">
            <span className="text-3xl">🏪</span>
            <p className="font-semibold text-amber-800 mt-2 text-sm">{t('merchant.tools.storefrontTitle')}</p>
            <p className="text-xs text-amber-600 mt-1">{t('merchant.tools.storefrontGenerating')}</p>
          </div>
        ) : (
          <Link href="/merchant/upgrade">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🏪</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">{t('merchant.tools.storefrontTitle')}</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('merchant.tools.storefrontDesc')}</p>
            </div>
          </Link>
        )}

        {/* VIP : Multi-caissier */}
        {isVip ? (
          <Link href="/merchant/cashiers">
            <div className="card text-center py-5 hover:border-amber-300 border-amber-200 bg-amber-50 transition-colors cursor-pointer">
              <span className="text-3xl">👥</span>
              <p className="font-semibold text-amber-800 mt-2 text-sm">{t('merchant.tools.multiCashierTitle')}</p>
              <p className="text-xs text-amber-600 mt-1">{t('merchant.tools.multiCashierDesc')}</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/upgrade">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">👥</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">{t('merchant.tools.multiCashierTitle')}</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('merchant.tools.multiCashierSubDesc')}</p>
            </div>
          </Link>
        )}

        {/* Service Agent — VIP requis + 10 000 activation */}
        {isAgent ? (
          <Link href="/merchant/agent">
            <div className="card text-center py-5 hover:border-blue-300 border-blue-200 bg-blue-50 transition-colors cursor-pointer">
              <span className="text-3xl">🏦</span>
              <p className="font-semibold text-blue-800 mt-2 text-sm">{t('merchant.tools.agentServiceTitle')}</p>
              <p className="text-xs text-blue-600 mt-1">{t('merchant.tools.agentServiceDesc')}</p>
            </div>
          </Link>
        ) : isVip ? (
          <Link href="/merchant/upgrade?tier=agent">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🏦</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">{t('merchant.tools.agentServiceTitle')}</p>
                <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">Gratuit</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('merchant.tools.agentServicePrice')}</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/upgrade?tier=vip">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🏦</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">{t('merchant.tools.agentServiceTitle')}</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP requis</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">VIP requis · activation gratuite en VIP</p>
            </div>
          </Link>
        )}

        {/* Recharge wallet client — Agent requis (+ VIP) */}
        {isAgent ? (
          <Link href="/merchant/cashin">
            <div className="card text-center py-5 hover:border-blue-300 border-blue-200 bg-blue-50 transition-colors cursor-pointer">
              <span className="text-3xl">💵</span>
              <p className="font-semibold text-blue-800 mt-2 text-sm">Recharge wallet</p>
              <p className="text-xs text-blue-600 mt-1">Cash contre wallet GreenFlame</p>
            </div>
          </Link>
        ) : (
          <div className="card text-center py-5 border-dashed opacity-40">
            <span className="text-3xl">💵</span>
            <p className="font-semibold text-gray-400 mt-2 text-sm">Recharge wallet</p>
            <p className="text-xs text-gray-400 mt-1">{isVip ? 'Service Agent requis' : 'VIP + Agent requis'}</p>
          </div>
        )}

        {/* Tontines-Produit */}
        <Link href="/merchant/tontines">
          <div className="card text-center py-5 hover:border-green-300 border-green-200 bg-green-50 transition-colors cursor-pointer">
            <span className="text-3xl">🤝</span>
            <p className="font-semibold text-green-800 mt-2 text-sm">Tontines-Produit</p>
            <p className="text-xs text-green-600 mt-1">Valider, suivre les commandes groupées & livraisons</p>
          </div>
        </Link>
      </div>

      {/* ── GESTION D'ACTIVITÉ ── */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
          Gestion d'activité
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* POS rapide — VIP requis */}
        {isVip ? (
          <Link href="/merchant/pos">
            <div className="card text-center py-5 hover:border-brand-400 border-brand-200 bg-brand-50 transition-colors cursor-pointer">
              <span className="text-3xl">🧾</span>
              <p className="font-semibold text-brand-800 mt-2 text-sm">POS Rapide</p>
              <p className="text-xs text-brand-600 mt-1">Vente en caisse — stock + caisse en une action</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/upgrade?tier=vip">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🧾</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">POS Rapide</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Vente en caisse — stock + caisse en une action</p>
            </div>
          </Link>
        )}

        {/* Stock boutique — VIP requis */}
        {isVip ? (
          <Link href="/merchant/stock">
            <div className="card text-center py-5 hover:border-blue-300 border-blue-200 bg-blue-50 transition-colors cursor-pointer">
              <span className="text-3xl">📦</span>
              <p className="font-semibold text-blue-800 mt-2 text-sm">Gestion de stock</p>
              <p className="text-xs text-blue-600 mt-1">Entrées, sorties, alertes seuil bas</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/upgrade?tier=vip">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">📦</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">Gestion de stock</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Entrées, sorties, alertes seuil bas</p>
            </div>
          </Link>
        )}

        <Link href="/merchant/clients">
          <div className="card text-center py-5 hover:border-purple-300 border-purple-200 bg-purple-50 transition-colors cursor-pointer">
            <span className="text-3xl">👥</span>
            <p className="font-semibold text-purple-800 mt-2 text-sm">Carnet clients</p>
            <p className="text-xs text-purple-600 mt-1">Historique, panier moyen, fidélité</p>
          </div>
        </Link>
        <Link href="/merchant/delivery">
          <div className="card text-center py-5 hover:border-indigo-300 border-indigo-200 bg-indigo-50 transition-colors cursor-pointer">
            <span className="text-3xl">🚴</span>
            <p className="font-semibold text-indigo-800 mt-2 text-sm">Livraisons</p>
            <p className="text-xs text-indigo-600 mt-1">Suivi des commandes & livreurs</p>
          </div>
        </Link>

        {/* Livre de caisse — VIP requis */}
        {isVip ? (
          <Link href="/merchant/caisse">
            <div className="card text-center py-5 hover:border-amber-300 border-amber-200 bg-amber-50 transition-colors cursor-pointer">
              <span className="text-3xl">📒</span>
              <p className="font-semibold text-amber-800 mt-2 text-sm">Livre de caisse</p>
              <p className="text-xs text-amber-600 mt-1">Recettes, dépenses, P&L mensuel simplifié</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/upgrade?tier=vip">
            <div className="card text-center py-5 cursor-pointer border-dashed opacity-60 hover:opacity-80 transition-opacity">
              <span className="text-3xl">📒</span>
              <div className="flex items-center justify-center gap-1 mt-2">
                <p className="font-semibold text-gray-500 text-sm">Livre de caisse</p>
                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">VIP</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Recettes, dépenses, P&L mensuel simplifié</p>
            </div>
          </Link>
        )}
      </div>

      {/* ── SÉPARATEUR OUTILS SECTORIELS ── */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
          {t('merchant.tools.sectoralTools')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* ── Outil sectoriel personnalisé (universel) ── */}
        {merchant.sector && merchant.sector_activated_at ? (
          <Link href={`/merchant/tools/${merchant.sector}`}>
            <div className="card text-center py-4 hover:border-brand-300 border-brand-200 bg-brand-50 transition-colors cursor-pointer">
              <span className="text-3xl">{SECTOR_LABELS[merchant.sector]?.icon ?? '✨'}</span>
              <p className="font-semibold text-brand-800 mt-2 text-sm">
                Mon outil — {SECTOR_LABELS[merchant.sector]?.label ?? merchant.sector}
              </p>
              <p className="text-[10px] text-green-600 font-medium mt-1.5">Actif ✓ · Personnalisé pour votre activité</p>
            </div>
          </Link>
        ) : (
          <Link href="/merchant/tools/activer">
            <div className="card text-center py-4 hover:border-brand-300 border-brand-200 bg-brand-50 transition-colors cursor-pointer">
              <span className="text-3xl">✨</span>
              <p className="font-semibold text-brand-800 mt-2 text-sm">Outil sectoriel personnalisé</p>
              <p className="text-[10px] text-brand-600 font-medium mt-1.5">10 000 FCFA/an · Configurer →</p>
            </div>
          </Link>
        )}

        {/* Salon / Beauté */}
        <Link href="/merchant/tools/salon">
          <div className="card text-center py-4 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">✂️</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.salonTitle')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('merchant.tools.salonDesc')}</p>
            {toolActive['salon'] ? (
              <p className="text-[10px] text-green-600 font-medium mt-1.5">
                {t('merchant.tools.toolActiveExpires').replace('{date}', fmtExpiry(toolExpiry['salon']) ?? '')}
              </p>
            ) : (
              <p className="text-[10px] text-orange-500 font-medium mt-1.5">10 000 FCFA/an</p>
            )}
          </div>
        </Link>
        {/* Couture & Mode */}
        <Link href="/merchant/tools/couture">
          <div className="card text-center py-4 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">🪡</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.coutureTitle')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('merchant.tools.coutureDesc')}</p>
            {toolActive['couture'] ? (
              <p className="text-[10px] text-green-600 font-medium mt-1.5">
                {t('merchant.tools.toolActiveExpires').replace('{date}', fmtExpiry(toolExpiry['couture']) ?? '')}
              </p>
            ) : (
              <p className="text-[10px] text-orange-500 font-medium mt-1.5">10 000 FCFA/an</p>
            )}
          </div>
        </Link>
        {/* Restauration */}
        <Link href="/merchant/tools/resto">
          <div className="card text-center py-4 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">🍲</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.restoTitle')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('merchant.tools.restoDesc')}</p>
            {toolActive['resto'] ? (
              <p className="text-[10px] text-green-600 font-medium mt-1.5">
                {t('merchant.tools.toolActiveExpires').replace('{date}', fmtExpiry(toolExpiry['resto']) ?? '')}
              </p>
            ) : (
              <p className="text-[10px] text-orange-500 font-medium mt-1.5">10 000 FCFA/an</p>
            )}
          </div>
        </Link>
        {/* BTP & Artisans */}
        <Link href="/merchant/tools/btp">
          <div className="card text-center py-4 hover:border-brand-300 transition-colors cursor-pointer">
            <span className="text-3xl">🏗️</span>
            <p className="font-semibold text-gray-800 mt-2 text-sm">{t('merchant.tools.btpTitle')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('merchant.tools.btpDesc')}</p>
            {toolActive['btp'] ? (
              <p className="text-[10px] text-green-600 font-medium mt-1.5">
                {t('merchant.tools.toolActiveExpires').replace('{date}', fmtExpiry(toolExpiry['btp']) ?? '')}
              </p>
            ) : (
              <p className="text-[10px] text-orange-500 font-medium mt-1.5">10 000 FCFA/an</p>
            )}
          </div>
        </Link>
      </div>

      {/* ── SÉPARATEUR ── */}
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
          {t('merchant.tools.statistics')}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500">{t('merchant.tools.thisMonth')}</p>
          <p className="text-2xl font-bold text-gray-900">{formatFcfa(monthGmv)}</p>
          <p className="text-xs text-gray-400">
            {monthTxs.length} {t('merchant.tools.transactions')}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">{t('merchant.tools.netReceived')}</p>
          <p className="text-2xl font-bold text-brand-600">{formatFcfa(monthNet)}</p>
          <p className="text-xs text-gray-400">
            {t('merchant.tools.afterCommission').replace('{amount}', formatFcfa(monthCommission))}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">{t('merchant.tools.thisWeek')}</p>
          <p className="text-xl font-bold text-gray-900">{formatFcfa(weekGmv)}</p>
          <p className="text-xs text-gray-400">
            {weekTxs.length} {t('merchant.tools.sales')}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">{t('merchant.tools.gmvTotal')}</p>
          <p className="text-xl font-bold text-gray-900">{formatFcfa(merchant.total_gmv)}</p>
          <p className="text-xs text-gray-400">{t('merchant.tools.sinceBeginning')}</p>
        </div>
      </div>

      {/* Graphique 7 jours */}
      <div className="card">
        <p className="font-semibold text-gray-900 mb-4">{t('merchant.tools.last7Days')}</p>
        <div className="flex items-end gap-1 h-28">
          {dailyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-brand-500 transition-all"
                style={{ height: `${Math.max((d.gmv / maxGmv) * 100, d.gmv > 0 ? 4 : 0)}%`, minHeight: d.gmv > 0 ? '4px' : '0' }}
              />
              <p className="text-[9px] text-gray-400 text-center leading-tight">{d.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Banniere VIP si actif */}
      {isVip && (
        <div className="bg-gradient-to-r from-amber-700 to-amber-500 rounded-2xl p-4 text-white flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">{t('merchant.tools.vipBanner')}</p>
            <p className="text-amber-100 text-xs mt-0.5">
              {t('merchant.tools.vipBannerDesc')}
              {vipExpiresLabel && ` · ${t('merchant.tools.vipExpires').replace('{date}', vipExpiresLabel)}`}
            </p>
          </div>
          <Link href="/merchant/upgrade" className="flex-shrink-0 bg-white text-amber-700 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            {t('merchant.tools.manage')}
          </Link>
        </div>
      )}

      {/* Bannière VIP upgrade pour les non-VIP */}
      {!isVip && (
        <div className="bg-gradient-to-r from-amber-800 to-amber-600 rounded-2xl p-4 text-white flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">{t('merchant.tools.vipUpgradeBanner')}</p>
            <p className="text-amber-100 text-xs mt-0.5">{t('merchant.tools.vipUpgradeBannerDesc')}</p>
          </div>
          <Link href="/merchant/upgrade?tier=vip" className="flex-shrink-0 bg-white text-amber-700 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            {t('merchant.tools.upgradeVip')}
          </Link>
        </div>
      )}

      {/* Historique des ventes */}
      <div className="card">
        <p className="font-semibold text-gray-900 mb-3">{t('merchant.tools.last50Sales')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 py-2 font-medium">{t('merchant.tools.clientHeader')}</th>
                <th className="text-right text-xs text-gray-400 py-2 font-medium">{t('merchant.tools.amountHeader')}</th>
                <th className="text-right text-xs text-gray-400 py-2 font-medium">{t('merchant.tools.netHeader')}</th>
                <th className="text-right text-xs text-gray-400 py-2 font-medium">{t('merchant.tools.dateHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allTxs.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-xs">{t('merchant.tools.noSales')}</td></tr>
              )}
              {allTxs.map((tx, i) => {
                const buyer = tx.buyers as unknown as { full_name: string } | null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-700">{buyer?.full_name ?? 'Client'}</td>
                    <td className="py-2 text-right font-medium">{formatFcfa(tx.amount_fcfa)}</td>
                    <td className="py-2 text-right text-brand-600">{formatFcfa(tx.amount_fcfa - tx.commission_total)}</td>
                    <td className="py-2 text-right text-gray-400 text-xs">
                      {new Date(tx.created_at).toLocaleDateString(localeCode, { day: '2-digit', month: 'short' })}
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
