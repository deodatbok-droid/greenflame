import { GOVERNANCE } from './constants'
import type { CommissionInput, CommissionResult, CommissionAllocation } from './types'

// Arrondit vers le bas pour eviter les erreurs de virgule flottante
// Toujours en centimes (entiers) pour les operations financieres
function roundDown(value: number): number {
  return Math.floor(value)
}

// Verifie si un kingmaker est actif (dernier achat < 90 jours)
function isKingmakerActive(userId: string, activeStatuses: Record<string, boolean>): boolean {
  return activeStatuses[userId] === true
}

export function calculateCommissions(input: CommissionInput): CommissionResult {
  const { transactionId, amountFcfa, commissionRate, buyerId, uplines, activeStatuses } = input

  // ASSERTION: toute commission doit avoir un transactionId valide
  if (!transactionId) {
    throw new Error('GOVERNANCE VIOLATION: commissions require a valid transactionId')
  }
  if (!buyerId) {
    throw new Error('GOVERNANCE VIOLATION: commissions require a valid buyerId')
  }

  // 1. Calcul de la commission totale
  const totalCommission = roundDown(amountFcfa * commissionRate)

  // 2. Distribution selon les invariants de gouvernance
  const platformFee       = roundDown(totalCommission * GOVERNANCE.PLATFORM_SHARE)
  const cashbackAmount    = roundDown(totalCommission * GOVERNANCE.CASHBACK_SHARE)
  const rewardsFundAmount = roundDown(totalCommission * GOVERNANCE.REWARDS_FUND_SHARE)
  const networkPool       = roundDown(totalCommission * GOVERNANCE.NETWORK_POOL_SHARE)

  // 3. Cashback → GFP si montant < seuil
  const cashbackIsGfp = cashbackAmount < GOVERNANCE.GFP_CASH_MIN_THRESHOLD

  // 4. Distribution reseau sur 5 niveaux
  const allocations: CommissionAllocation[] = []

  // Platform fee (niveau 0)
  allocations.push({
    recipientId: null,
    level: 0,
    amountFcfa: platformFee,
    percentage: GOVERNANCE.PLATFORM_SHARE,
    distributionType: 'platform',
    isGfp: false,
  })

  // Cashback acheteur (convention niveau 6)
  allocations.push({
    recipientId: buyerId,
    level: 6,
    amountFcfa: cashbackAmount,
    percentage: GOVERNANCE.CASHBACK_SHARE,
    distributionType: 'cashback',
    isGfp: cashbackIsGfp,
  })

  // Fonds Récompenses/Événements (convention niveau 8)
  allocations.push({
    recipientId: null,
    level: 8,
    amountFcfa: rewardsFundAmount,
    percentage: GOVERNANCE.REWARDS_FUND_SHARE,
    distributionType: 'rewards_fund',
    isGfp: false,
  })

  // Distribution reseau L1-L5
  let spilloverAmount = 0
  const levels: Array<{ key: string; level: number }> = [
    { key: 'l1', level: 1 },
    { key: 'l2', level: 2 },
    { key: 'l3', level: 3 },
    { key: 'l4', level: 4 },
    { key: 'l5', level: 5 },
  ]

  for (const { key, level } of levels) {
    const levelKey = `L${level}` as keyof typeof GOVERNANCE.NETWORK_LEVELS
    const percentage = GOVERNANCE.NETWORK_LEVELS[levelKey]
    const levelAmount = roundDown(totalCommission * percentage)
    const uplineId = uplines[key as keyof typeof uplines]

    if (!uplineId) {
      // Niveau orphelin → spillover
      spilloverAmount += levelAmount
      allocations.push({
        recipientId: null,
        level,
        amountFcfa: levelAmount,
        percentage,
        distributionType: 'spillover',
        isGfp: false,
        spilloverReason: 'orphan_level',
      })
    } else if (!isKingmakerActive(uplineId, activeStatuses)) {
      // Kingmaker inactif → spillover
      spilloverAmount += levelAmount
      allocations.push({
        recipientId: null,
        level,
        amountFcfa: levelAmount,
        percentage,
        distributionType: 'spillover',
        isGfp: false,
        spilloverReason: 'inactive_kingmaker',
      })
    } else {
      // Kingmaker actif → commission reseau
      allocations.push({
        recipientId: uplineId,
        level,
        amountFcfa: levelAmount,
        percentage,
        distributionType: 'network',
        isGfp: false,
      })
    }
  }

  // Verification d'integrite : la somme des allocations ne doit pas depasser totalCommission
  const allocatedSum = allocations.reduce((sum, a) => sum + a.amountFcfa, 0)
  // Les arrondis vers le bas peuvent laisser un reste de quelques centimes → spillover
  const remainder = totalCommission - allocatedSum
  if (remainder > 0) {
    spilloverAmount += remainder
    allocations.push({
      recipientId: null,
      level: 0,
      amountFcfa: remainder,
      percentage: 0,
      distributionType: 'spillover',
      isGfp: false,
      spilloverReason: 'rounding_remainder',
    })
  }

  return {
    transactionId,
    totalCommission,
    commissionRate,
    platformFee,
    cashbackAmount,
    cashbackIsGfp,
    rewardsFundAmount,
    networkPool,
    spilloverAmount,
    allocations,
  }
}

// Calcule les commissions mensuelles estimees pour un kingmaker
// Utilise pour le scenario Kofi et les projections reseau
export function estimateMonthlyKingmakerCommissions(params: {
  directRecruits: number      // nombre de recrues directes
  branchingFactor: number     // chaque recrue recrute N personnes
  avgMonthlySpend: number     // depenses mensuelles moyennes par personne (FCFA)
  commissionRate: number      // taux de commission marchand par defaut
  levels?: number             // profondeur du reseau (max 5)
}): number {
  const { directRecruits, branchingFactor, avgMonthlySpend, commissionRate, levels = 5 } = params

  let totalCommissions = 0

  for (let l = 1; l <= levels; l++) {
    const membersAtLevel = Math.pow(branchingFactor, l - 1) * directRecruits
    const levelKey = `L${l}` as keyof typeof GOVERNANCE.NETWORK_LEVELS
    const levelRate = GOVERNANCE.NETWORK_LEVELS[levelKey]
    const commissionPerPerson = avgMonthlySpend * commissionRate * levelRate
    totalCommissions += membersAtLevel * commissionPerPerson
  }

  return Math.floor(totalCommissions)
}
