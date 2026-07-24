import Link from 'next/link'
import { PLANS } from '@/lib/merchant/plans'

interface Props {
  currentTier: string
  expiresAt: string | null
}

export default function PricingCards({ currentTier, expiresAt }: Props) {
  const now = new Date()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PLANS.map(plan => {
        const isVip = plan.id === 'vip'
        const isActive = isVip
          ? currentTier === 'vip' && !!expiresAt && new Date(expiresAt) > now
          : currentTier !== 'vip' || !expiresAt || new Date(expiresAt) <= now
            ? true
            : false

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border-2 p-5 transition-shadow ${
              isVip
                ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-400 shadow-lg shadow-amber-100'
                : 'bg-gradient-to-br from-brand-50 to-brand-100 border-brand-200'
            }`}
          >
            {/* Badge actif / recommandé */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
              {isActive && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isVip ? 'bg-amber-200 text-amber-800' : 'bg-brand-600 text-white'
                }`}>
                  ✓ Plan actif
                </span>
              )}
              {!isActive && isVip && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">
                  Recommandé
                </span>
              )}
            </div>

            {/* En-tête */}
            <div className="mb-4 pr-24">
              <h2 className={`text-xl font-bold ${isVip ? 'text-amber-900' : 'text-gray-900'}`}>
                {plan.icon} {plan.label}
              </h2>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className={`text-3xl font-bold ${isVip ? 'text-amber-700' : 'text-brand-700'}`}>
                  {plan.priceLabel}
                </span>
                {isVip && (
                  <span className="text-gray-500 text-sm">{plan.pricePeriod}</span>
                )}
                {!isVip && (
                  <span className="text-gray-500 text-sm ml-1">{plan.pricePeriod}</span>
                )}
              </div>
              <p className={`text-xs mt-0.5 font-medium ${isVip ? 'text-amber-700' : 'text-brand-600'}`}>
                {plan.tagline}
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-1.5 mb-5 flex-1">
              {plan.features.map(f => (
                <li key={f.label} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-base leading-none flex-shrink-0">{f.icon}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            {isActive ? (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${
                isVip ? 'bg-amber-600/10' : 'bg-brand-600/10'
              }`}>
                <span className="text-lg">✅</span>
                <p className={`text-sm font-semibold ${isVip ? 'text-amber-800' : 'text-brand-800'}`}>
                  Votre plan actuel
                </p>
              </div>
            ) : isVip ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/merchant/upgrade?tier=vip"
                  className="block text-center w-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Passer au VIP — 15 000 FCFA / an
                </Link>
                <Link
                  href="/merchant/upgrade?tier=vip&cash=1"
                  className="block text-center w-full border-2 border-amber-300 text-amber-700 font-semibold py-2.5 rounded-xl hover:bg-amber-50 transition-colors text-sm"
                >
                  Payer en espèces
                </Link>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
