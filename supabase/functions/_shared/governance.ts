// GREENFLAME — Constantes de gouvernance (source unique pour les Edge Functions)
// Doit rester identique a lib/commission-engine/constants.ts (Next.js).
// NE JAMAIS MODIFIER ces valeurs sans mise a jour simultanee des deux fichiers.

export const GOVERNANCE = {
  PLATFORM_SHARE: 0.45,
  CASHBACK_SHARE: 0.12,         // réduit depuis 15%
  REWARDS_FUND_SHARE: 0.03,     // Fonds Récompenses/Événements (30% récomp. / 70% événements)
  NETWORK_POOL_SHARE: 0.40,
  NETWORK_LEVELS: { L1: 0.12, L2: 0.10, L3: 0.08, L4: 0.06, L5: 0.04 } as Record<string, number>,
  GFP_CASH_MIN_THRESHOLD: 50,
  INACTIVITY_SPILLOVER_DAYS: 90,
} as const

export function validateGovernanceConstants(): void {
  const { PLATFORM_SHARE, CASHBACK_SHARE, REWARDS_FUND_SHARE, NETWORK_POOL_SHARE, NETWORK_LEVELS } = GOVERNANCE
  const distSum = PLATFORM_SHARE + CASHBACK_SHARE + REWARDS_FUND_SHARE + NETWORK_POOL_SHARE
  if (Math.abs(distSum - 1.0) > 0.0001) {
    throw new Error(`GOVERNANCE VIOLATION: distribution sum ${distSum} != 1.0`)
  }
  const networkSum = Object.values(NETWORK_LEVELS).reduce((a: number, b: number) => a + b, 0)
  if (Math.abs(networkSum - NETWORK_POOL_SHARE) > 0.0001) {
    throw new Error(`GOVERNANCE VIOLATION: network levels ${networkSum} != NETWORK_POOL_SHARE`)
  }
}
