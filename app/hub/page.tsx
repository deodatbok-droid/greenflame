import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import { getServerT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'GreenFlame Hub — Abonnements & Services',
  description: 'Plan Standard gratuit, VIP 5 000 FCFA/mois, outils sectoriels et Service Agent.',
}

const TOOL_PRICE = 5_000   // tous les outils sectoriels au même prix

export default async function HubPage() {
  const svc = createServiceClient()
  const { t } = await getServerT()

  // Récupérer les outils sectoriels depuis la DB (pour nom + description + disponibilité)
  const { data: hub } = await svc
    .from('merchants')
    .select('id')
    .eq('is_platform_hub', true)
    .single()

  const toolProducts = hub ? (await svc
    .from('products')
    .select('id, name, description, emoji, subscription_trigger')
    .eq('merchant_id', hub.id)
    .eq('is_available', true)
    .in('subscription_trigger', ['salon', 'couture', 'btp', 'resto'])
    .order('sort_order')).data ?? [] : []

  const toolCards = [
    { trigger: 'salon', color: 'from-pink-600 to-pink-900', badge: '✂️ Salon', badgeCls: 'bg-pink-300 text-pink-900', perks: t('hub.salonPerks').split('|'), href: '/merchant/tools/salon' },
    { trigger: 'couture', color: 'from-violet-600 to-violet-900', badge: '🪡 Couture', badgeCls: 'bg-violet-300 text-violet-900', perks: t('hub.couturePerks').split('|'), href: '/merchant/tools/couture' },
    { trigger: 'btp', color: 'from-orange-600 to-orange-900', badge: '🏗️ BTP', badgeCls: 'bg-orange-300 text-orange-900', perks: t('hub.btpPerks').split('|'), href: '/merchant/tools/btp' },
    { trigger: 'resto', color: 'from-green-700 to-green-900', badge: '🍲 Resto', badgeCls: 'bg-green-300 text-green-900', perks: t('hub.restoPerks').split('|'), href: '/merchant/tools/resto' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white px-4 pt-12 pb-8 text-center">
        <p className="text-4xl mb-3">🔥</p>
        <h1 className="text-2xl font-bold">{t('hub.title')}</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">{t('hub.heroDesc')}</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* ── ABONNEMENTS MARCHANDS ── */}
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-2">
          {t('hub.merchantPlans')}
        </h2>

        {/* Standard — GRATUIT */}
        <div className="rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-brand-700 to-brand-900 text-white">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 bg-brand-400 text-brand-900">
                  ⚡ Standard
                </span>
                <h2 className="text-lg font-bold">Plan Standard</h2>
                <p className="text-sm opacity-80 mt-1">{t('hub.includedLabel')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold">{t('hub.free')}</p>
                <p className="text-xs opacity-70">{t('hub.perMonth')}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5">
              {t('hub.standardPerks').split('|').map(perk => (
                <li key={perk} className="flex items-center gap-2 text-sm">
                  <span className="text-green-300 flex-shrink-0">✓</span>
                  <span className="opacity-90">{perk}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-center gap-2 bg-white/10 rounded-xl py-3 text-sm font-semibold opacity-80">
              <span>✅</span> {t('hub.includedLabel')}
            </div>
          </div>
        </div>

        {/* VIP — 5 000 FCFA/mois · ou 50 000/an */}
        <div className="rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-amber-600 to-amber-900 text-white">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 bg-amber-400 text-amber-900">
                  👑 VIP
                </span>
                <h2 className="text-lg font-bold">Plan VIP</h2>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold">{formatFcfa(5_000)}</p>
                <p className="text-xs opacity-70">{t('hub.perMonth')}</p>
                <p className="text-xs opacity-50 mt-0.5">ou {formatFcfa(50_000)}/an</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5">
              {t('hub.vipPerks').split('|').map(perk => (
                <li key={perk} className="flex items-center gap-2 text-sm">
                  <span className="text-green-300 flex-shrink-0">✓</span>
                  <span className="opacity-90">{perk}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/merchant/upgrade?tier=vip"
              className="mt-5 block text-center bg-white/20 hover:bg-white/30 transition-colors font-semibold py-3 rounded-xl text-sm"
            >
              {t('hub.subscribeVip')}
            </Link>
          </div>
        </div>

        {/* Agent — 10 000 FCFA activation unique */}
        <div className="rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-blue-700 to-blue-900 text-white">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 bg-blue-400 text-blue-900">
                  🏦 Agent
                </span>
                <h2 className="text-lg font-bold">Service Agent</h2>
                <p className="text-sm opacity-70 mt-1">⚠️ Float requis (Wallet GreenFlame)</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold">{formatFcfa(10_000)}</p>
                <p className="text-xs opacity-70">activation unique</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5">
              {t('hub.agentPerks').split('|').map(perk => (
                <li key={perk} className="flex items-center gap-2 text-sm">
                  <span className="text-green-300 flex-shrink-0">✓</span>
                  <span className="opacity-90">{perk}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/merchant/upgrade?tier=agent"
              className="mt-5 block text-center bg-white/20 hover:bg-white/30 transition-colors font-semibold py-3 rounded-xl text-sm"
            >
              {t('hub.activateAgent')}
            </Link>
          </div>
        </div>

        {/* ── OUTILS SECTORIELS ── */}
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-4">
          {t('hub.sectoralTools')}
        </h2>
        <p className="text-xs text-gray-500 -mt-3">
          {formatFcfa(TOOL_PRICE)}{t('hub.perMonth')} · ou {formatFcfa(50_000)}/an — tous les secteurs au même prix
        </p>

        {toolCards.map(card => {
          const product = toolProducts.find(p => p.subscription_trigger === card.trigger)
          return (
            <div key={card.trigger} className={`rounded-2xl overflow-hidden shadow-md bg-gradient-to-br ${card.color} text-white`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${card.badgeCls}`}>
                      {card.badge}
                    </span>
                    <h2 className="text-lg font-bold">{product?.name ?? card.badge}</h2>
                    {product?.description && (
                      <p className="text-sm opacity-80 mt-1">{product.description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold">{formatFcfa(TOOL_PRICE)}</p>
                    <p className="text-xs opacity-70">{t('hub.perMonth')}</p>
                    <p className="text-xs opacity-50 mt-0.5">ou {formatFcfa(50_000)}/an</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {card.perks.map(perk => (
                    <li key={perk} className="flex items-center gap-2 text-sm">
                      <span className="text-green-300 flex-shrink-0">✓</span>
                      <span className="opacity-90">{perk}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={card.href}
                  className="mt-5 block text-center bg-white/20 hover:bg-white/30 transition-colors font-semibold py-3 rounded-xl text-sm"
                >
                  {t('hub.activateTool').replace('{badge}', card.badge)}
                </Link>
              </div>
            </div>
          )
        })}

        <div className="text-center pt-2 pb-6">
          <Link href="/marketplace" className="text-xs text-gray-400 hover:text-brand-600">
            {t('hub.backToMarketplace')}
          </Link>
        </div>
      </div>
    </div>
  )
}
