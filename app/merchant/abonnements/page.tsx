import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PricingCards from '@/components/merchant/PricingCards'
import { TOOLS_CATALOG } from '@/lib/merchant/tools-catalog'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ bienvenue?: string }>
}

export default async function AbonnementsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, subscription_tier, subscription_expires_at, business_category')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const params = await searchParams
  const isBienvenue = params.bienvenue === '1'

  const tier = merchant.subscription_tier ?? 'standard'
  const expiresAt = merchant.subscription_expires_at ?? null
  const now = new Date()
  const isVipActive = tier === 'vip' && !!expiresAt && new Date(expiresAt) > now

  // Fetch tool subscription for this merchant
  const { data: toolSubs } = isVipActive
    ? await supabase
        .from('tool_subscriptions')
        .select('tool_slug, expires_at')
        .gt('expires_at', now.toISOString())
        .limit(1)
    : { data: [] as { tool_slug: string; expires_at: string }[] }

  const currentToolSub = (toolSubs ?? [])[0] ?? null
  const currentToolInfo = currentToolSub
    ? TOOLS_CATALOG.find(t => t.slug === currentToolSub.tool_slug)
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-6">

      {/* Bannière de bienvenue */}
      {isBienvenue && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-5 text-white">
          <p className="text-lg font-bold mb-1">🎉 Bienvenue dans votre espace marchand !</p>
          <p className="text-sm text-brand-100 leading-relaxed">
            Votre boutique est créée. Découvrez les formules disponibles et activez les fonctionnalités qui correspondent à votre activité.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/merchant/products" className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              Ajouter des produits →
            </Link>
            <Link href="/merchant/receive" className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
              Encaisser un paiement
            </Link>
          </div>
        </div>
      )}

      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnements</h1>
        <p className="text-sm text-gray-500 mt-1">Comparez les formules et gérez votre plan GreenFlame.</p>
      </div>

      {/* Comparatif visuel */}
      <PricingCards currentTier={tier} expiresAt={expiresAt} />

      {/* Info expiration VIP */}
      {isVipActive && expiresAt && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="flex-shrink-0">👑</span>
          <span>
            Plan VIP actif jusqu&apos;au{' '}
            <strong>
              {new Date(expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </strong>.
          </span>
        </div>
      )}

      {/* Section outil sectoriel — VIP uniquement */}
      {isVipActive && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">🛠️ Outil sectoriel inclus</h2>
            {currentToolSub ? (
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                ✓ Actif
              </span>
            ) : (
              <Link
                href="/merchant/upgrade?tool_select=1"
                className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Choisir mon outil →
              </Link>
            )}
          </div>

          <div className="px-5 py-4">
            {currentToolSub && currentToolInfo ? (
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{currentToolInfo.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{currentToolInfo.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{currentToolInfo.description}</p>
                  {currentToolSub.expires_at && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Valide jusqu&apos;au{' '}
                      {new Date(currentToolSub.expires_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <Link
                  href={`/merchant/tools/${currentToolSub.tool_slug}`}
                  className="flex-shrink-0 text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                >
                  Ouvrir →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Votre plan VIP inclut <strong>1 outil sectoriel offert</strong> pour l&apos;année. Choisissez l&apos;outil adapté à votre secteur d&apos;activité.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['💇 Salon & Beauté', '🧵 Couture', '🏗️ BTP', '🍽️ Restaurant'].map(f => (
                    <span key={f} className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2.5 py-1 rounded-full">
                      {f}
                    </span>
                  ))}
                  <span className="bg-gray-50 border border-gray-200 text-gray-500 text-xs px-2.5 py-1 rounded-full">
                    + d&apos;autres bientôt
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retour */}
      <div className="text-center">
        <Link href="/merchant/dashboard" className="text-sm text-gray-500 hover:text-gray-600 transition-colors">
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
