// GREENFLAME — Constantes de gouvernance
// CES VALEURS SONT VERROUILLEES. Toute tentative de modification doit etre
// bloquee, loggee dans governance_audit, et alerter l'admin immediatement.

export const GOVERNANCE = {
  // Distribution de la commission marchande (somme = 100%)
  PLATFORM_SHARE: 0.45,         // 45% → revenu plateforme
  CASHBACK_SHARE: 0.12,         // 12% → cashback acheteur (réduit depuis 15%)
  REWARDS_FUND_SHARE: 0.03,     // 3%  → Marge de Manœuvre Communautaire (événements, initiatives, urgences)
  NETWORK_POOL_SHARE: 0.40,     // 40% → VERROUILLÉ, ne peut jamais descendre

  // Distribution reseau par niveau (somme = 40%)
  NETWORK_LEVELS: {
    L1: 0.12,
    L2: 0.10,
    L3: 0.08,
    L4: 0.06,
    L5: 0.04,
  } as Record<string, number>,

  // Taux de commission par defaut
  DEFAULT_COMMISSION_RATE: 0.10,

  // GFP (Points GreenFlame)
  GFP_CASH_MIN_THRESHOLD: 50,   // en FCFA — sous ce montant → GFP
  FCFA_TO_GFP_RATE: 10,         // 1 FCFA = 10 GFP
  GFP_TO_FCFA_RATE: 0.1,        // 1 GFP = 0,1 FCFA (10 GFP = 1 FCFA)
  GFP_MIN_WITHDRAWAL: 50000,    // 50 000 GFP minimum pour retrait cash (= 5 000 FCFA)
  GFP_VALIDITY_MONTHS: 24,

  // Regles reseau
  INACTIVITY_SPILLOVER_DAYS: 90, // si Kingmaker inactif > 90j → spillover
  MAX_NETWORK_DEPTH: 5,

  // Regles structurelles
  ZERO_ENTRY_FEE: true,
  REVENUE_FROM_TRANSACTIONS_ONLY: true,
  GROSSISTE_NEVER_SELLS_TO_CONSUMERS: true,
} as const

// Split des dividendes communautaires reçus par chaque Cercle (L1-L5)
// Le brut = 100% → 60% cash immédiat, 30% droit aux bons d'achat GF, 10% Fonds de Reconnaissance
export const DIVIDENDE_SPLIT = {
  CASH:        0.60,
  VOUCHER:     0.30,
  RECOGNITION: 0.10,
} as const

// Taux de commission par categorie marchand
export const CATEGORY_RATES: Record<string, number> = {
  ALIMENTATION: 0.10,
  PHARMACIE: 0.10,
  ELECTRONIQUE: 0.10,
  AIRTIME: 0.10,
  SERVICES: 0.10,
  TRANSPORT_SMALL: 0.03,   // < 500 FCFA
  TRANSPORT_MED: 0.04,     // 500-2000 FCFA
  TRANSPORT_LARGE: 0.05,   // > 2000 FCFA
  RESTAURATION_SMALL: 0.03,
  GROSSISTE: 0.05,
  DELIVERY: 0.05,           // GreenFlame Delivery — taux fixe 5% des frais de livraison
  SERVICES_PREMIUM: 0.15,  // C-15 — services spécialisés (académie, accompagnement, conseil)
}

// Validation — a appeler au demarrage de l'application
export function validateGovernanceConstants(): void {
  const { PLATFORM_SHARE, CASHBACK_SHARE, REWARDS_FUND_SHARE, NETWORK_POOL_SHARE, NETWORK_LEVELS } = GOVERNANCE

  const distributionSum = PLATFORM_SHARE + CASHBACK_SHARE + REWARDS_FUND_SHARE + NETWORK_POOL_SHARE
  if (Math.abs(distributionSum - 1.0) > 0.0001) {
    throw new Error(`GOVERNANCE VIOLATION: distribution sum is ${distributionSum}, expected 1.0`)
  }

  const networkSum = Object.values(NETWORK_LEVELS).reduce((a, b) => a + b, 0)
  if (Math.abs(networkSum - NETWORK_POOL_SHARE) > 0.0001) {
    throw new Error(`GOVERNANCE VIOLATION: network levels sum ${networkSum} ≠ NETWORK_POOL_SHARE ${NETWORK_POOL_SHARE}`)
  }

  if (NETWORK_POOL_SHARE < 0.40) {
    throw new Error(`GOVERNANCE VIOLATION: NETWORK_POOL_SHARE (${NETWORK_POOL_SHARE}) is below 40% minimum`)
  }
}
