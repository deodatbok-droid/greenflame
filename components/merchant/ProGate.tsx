import Link from 'next/link'

type Tier = 'free' | 'standard' | 'pro' | 'vip'

interface ProGateProps {
  tier: Tier
  /** Minimum tier required — 'standard' = all merchants, 'vip' = VIP only */
  requires?: 'standard' | 'vip'
  children: React.ReactNode
  featureName?: string
  featureIcon?: string
}

/**
 * ProGate — wraps VIP-only content.
 * Standard features are FREE for all merchants — requires='standard' always grants access.
 *
 * Usage:
 *   <ProGate tier={merchant.subscription_tier} requires="vip" featureName="Vitrine publique">
 *     <StorefrontPanel />
 *   </ProGate>
 */
export default function ProGate({
  tier,
  requires = 'standard',
  children,
  featureName = 'Cette fonctionnalité',
  featureIcon = '⭐',
}: ProGateProps) {
  // Standard features are free for all merchants
  if (requires === 'standard') return <>{children}</>

  // VIP gate
  const isVip = tier === 'vip'
  if (isVip) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-40 overflow-hidden max-h-48">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
        <div className="text-center px-6 py-8 max-w-xs">
          <div className="w-14 h-14 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
            {featureIcon}
          </div>
          <p className="font-semibold text-gray-900 mb-1">{featureName}</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Disponible avec le plan VIP — 5 000 FCFA/mois.
          </p>
          <Link
            href="/merchant/upgrade?tier=vip"
            className="inline-block bg-amber-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-amber-700 transition-colors"
          >
            Passer en VIP →
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Compact inline badge signaling VIP-only features */
export function ProBadge({ tier, requires = 'standard' }: { tier: Tier; requires?: 'standard' | 'vip' }) {
  if (requires === 'standard') return null
  const isVip = tier === 'vip'
  if (isVip) return null
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 bg-amber-100 text-amber-700">
      VIP
    </span>
  )
}

/** Full-width banner — promotes VIP upgrade for non-VIP merchants */
export function UpgradeBanner({ tier }: { tier: string }) {
  if (tier === 'vip') return null
  return (
    <div className="bg-gradient-to-r from-amber-700 to-amber-600 rounded-2xl p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-amber-200 font-medium uppercase tracking-wide mb-1">
            👑 Passez au VIP
          </p>
          <h3 className="font-semibold text-base mb-1">Vitrine publique, multi-caissier & gestion d&apos;entreprise</h3>
          <p className="text-sm text-amber-200 leading-relaxed">
            Développez votre activité avec les outils VIP GreenFlame — <strong className="text-white">5 000 FCFA/mois</strong>.
          </p>
        </div>
        <Link
          href="/merchant/upgrade?tier=vip"
          className="flex-shrink-0 bg-white text-amber-700 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
        >
          Voir les offres →
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {['🏪 Vitrine publique', '👥 Multi-caissier', '📈 Gestion entreprise', '👑 Badge VIP'].map(f => (
          <span key={f} className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}
