export type PlanId = 'standard' | 'vip'

export interface PlanFeature {
  icon: string
  label: string
}

export interface Plan {
  id: PlanId
  label: string
  icon: string
  price: number
  priceLabel: string
  pricePeriod: string
  tagline: string
  accent: 'brand' | 'amber'
  includesToolSlot: boolean
  features: PlanFeature[]
}

export const PLANS: Plan[] = [
  {
    id: 'standard',
    label: 'Standard',
    icon: '⚡',
    price: 0,
    priceLabel: 'Gratuit',
    pricePeriod: 'pour tous les marchands',
    tagline: 'Tout pour démarrer votre activité',
    accent: 'brand',
    includesToolSlot: false,
    features: [
      { icon: '📦', label: '10 produits en vitrine' },
      { icon: '🧾', label: 'Factures & devis illimités' },
      { icon: '📈', label: 'Stats du mois & du jour' },
      { icon: '🔗', label: 'Lien de paiement QR' },
      { icon: '💬', label: 'Support communauté' },
      { icon: '🎯', label: 'Score marchand GreenFlame' },
    ],
  },
  {
    id: 'vip',
    label: 'VIP',
    icon: '👑',
    price: 15000,
    priceLabel: '15 000',
    pricePeriod: 'FCFA / an',
    tagline: 'Tout pour développer votre activité',
    accent: 'amber',
    includesToolSlot: true,
    features: [
      { icon: '✅', label: 'Tout le Standard inclus' },
      { icon: '🏪', label: 'Vitrine publique en ligne' },
      { icon: '👥', label: 'Multi-caissiers' },
      { icon: '📊', label: 'Analytics avancés' },
      { icon: '🧾', label: 'POS + Stock + Livre de caisse' },
      { icon: '🛠️', label: '1 outil sectoriel (1 an)' },
      { icon: '🏦', label: 'Service Agent inclus' },
      { icon: '⭐', label: 'Mise en avant 7 jours' },
      { icon: '👑', label: 'Badge VIP marchand' },
    ],
  },
]

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find(p => p.id === id)
}
