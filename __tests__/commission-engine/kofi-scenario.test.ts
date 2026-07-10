import { calculateCommissions, estimateMonthlyKingmakerCommissions } from '@/lib/commission-engine/calculate'
import { GOVERNANCE, validateGovernanceConstants } from '@/lib/commission-engine/constants'
import type { CommissionInput } from '@/lib/commission-engine/types'

// IDs de test
const KOFI_ID = 'kofi-user-id'
const L1_ID = 'l1-kingmaker-id'
const L2_ID = 'l2-kingmaker-id'
const L3_ID = 'l3-kingmaker-id'
const L4_ID = 'l4-kingmaker-id'
const L5_ID = 'l5-kingmaker-id'
const BUYER_ID = 'buyer-user-id'
const MERCHANT_ID = 'merchant-id'

const ALL_ACTIVE: Record<string, boolean> = {
  [KOFI_ID]: true,
  [L1_ID]: true,
  [L2_ID]: true,
  [L3_ID]: true,
  [L4_ID]: true,
  [L5_ID]: true,
  [BUYER_ID]: true,
}

function makeInput(overrides: Partial<CommissionInput> = {}): CommissionInput {
  return {
    transactionId: 'tx-test-001',
    amountFcfa: 1000,
    commissionRate: 0.10,
    buyerId: BUYER_ID,
    merchantId: MERCHANT_ID,
    uplines: { l1: L1_ID, l2: L2_ID, l3: L3_ID, l4: L4_ID, l5: L5_ID },
    activeStatuses: ALL_ACTIVE,
    ...overrides,
  }
}

describe('Governance Constants', () => {
  test('validateGovernanceConstants ne lève pas d\'erreur', () => {
    expect(() => validateGovernanceConstants()).not.toThrow()
  })

  test('Distribution 45/12/3/40 — somme = 100%', () => {
    const sum = GOVERNANCE.PLATFORM_SHARE + GOVERNANCE.CASHBACK_SHARE + GOVERNANCE.REWARDS_FUND_SHARE + GOVERNANCE.NETWORK_POOL_SHARE
    expect(sum).toBeCloseTo(1.0, 5)
  })

  test('Niveaux réseau L1-L5 — somme = 40%', () => {
    const sum = Object.values(GOVERNANCE.NETWORK_LEVELS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(GOVERNANCE.NETWORK_POOL_SHARE, 5)
  })

  test('NETWORK_POOL_SHARE ne peut pas être < 40%', () => {
    expect(GOVERNANCE.NETWORK_POOL_SHARE).toBeGreaterThanOrEqual(0.40)
  })
})

describe('Commission Engine — Transaction 1 000 FCFA', () => {
  test('Commission totale = 100 FCFA (10% de 1000)', () => {
    const result = calculateCommissions(makeInput())
    expect(result.totalCommission).toBe(100)
  })

  test('Platform fee = 45 FCFA', () => {
    const result = calculateCommissions(makeInput())
    expect(result.platformFee).toBe(45)
  })

  test('Cashback = 12 FCFA → PGF car < 50 FCFA', () => {
    const result = calculateCommissions(makeInput())
    expect(result.cashbackAmount).toBe(12)
    expect(result.cashbackIsGfp).toBe(true)
  })

  test('L1 reçoit 12 FCFA', () => {
    const result = calculateCommissions(makeInput())
    const l1 = result.allocations.find(a => a.level === 1)
    expect(l1?.amountFcfa).toBe(12)
    expect(l1?.recipientId).toBe(L1_ID)
  })

  test('L2 reçoit 10 FCFA', () => {
    const result = calculateCommissions(makeInput())
    const l2 = result.allocations.find(a => a.level === 2)
    expect(l2?.amountFcfa).toBe(10)
  })

  test('L3 reçoit 8 FCFA', () => {
    const result = calculateCommissions(makeInput())
    const l3 = result.allocations.find(a => a.level === 3)
    expect(l3?.amountFcfa).toBe(8)
  })

  test('L4 reçoit 6 FCFA', () => {
    const result = calculateCommissions(makeInput())
    const l4 = result.allocations.find(a => a.level === 4)
    expect(l4?.amountFcfa).toBe(6)
  })

  test('L5 reçoit 4 FCFA', () => {
    const result = calculateCommissions(makeInput())
    const l5 = result.allocations.find(a => a.level === 5)
    expect(l5?.amountFcfa).toBe(4)
  })
})

describe('Commission Engine — Cashback FCFA vs PGF', () => {
  test('Transaction 300 FCFA @ 10% → cashback 3 FCFA → PGF (< 50)', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 300 }))
    expect(result.cashbackAmount).toBe(3)  // 300 * 0.10 * 0.12 = 3.6 → floor = 3
    expect(result.cashbackIsGfp).toBe(true)
  })

  test('Transaction 1 000 FCFA → cashback 12 FCFA → PGF', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 1000 }))
    expect(result.cashbackAmount).toBe(12)
    expect(result.cashbackIsGfp).toBe(true)
  })

  test('Transaction 5 000 FCFA @ 10% → cashback 60 FCFA → FCFA (> 50)', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 5000 }))
    expect(result.cashbackAmount).toBe(60)
    expect(result.cashbackIsGfp).toBe(false)
  })

  test('Transaction 10 000 FCFA → cashback 120 FCFA → FCFA', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 10000 }))
    expect(result.cashbackAmount).toBe(120)
    expect(result.cashbackIsGfp).toBe(false)
  })
})

describe('Commission Engine — Spillover', () => {
  test('Niveau orphelin (pas d\'upline L3/L4/L5) → spillover', () => {
    const result = calculateCommissions(makeInput({
      uplines: { l1: L1_ID, l2: L2_ID },
    }))
    const spillovers = result.allocations.filter(a => a.distributionType === 'spillover')
    const spilloverTotal = spillovers.reduce((sum, s) => sum + s.amountFcfa, 0)
    // L3=8, L4=6, L5=4 → 18 FCFA en spillover
    expect(spilloverTotal).toBeGreaterThanOrEqual(18)
    expect(result.spilloverAmount).toBeGreaterThan(0)
  })

  test('Kingmaker inactif > 90j → sa part va au spillover', () => {
    const result = calculateCommissions(makeInput({
      activeStatuses: { ...ALL_ACTIVE, [L1_ID]: false },
    }))
    const spillovers = result.allocations.filter(a => a.distributionType === 'spillover')
    const spilloverTotal = spillovers.reduce((sum, s) => sum + s.amountFcfa, 0)
    // L1 (12 FCFA) → spillover
    expect(spilloverTotal).toBeGreaterThanOrEqual(12)
  })

  test('Chaîne vide → tout le réseau part en spillover', () => {
    const result = calculateCommissions(makeInput({
      uplines: {},
    }))
    // L1+L2+L3+L4+L5 = 12+10+8+6+4 = 40 FCFA → tout spillover
    const spillovers = result.allocations.filter(a => a.distributionType === 'spillover')
    const spilloverTotal = spillovers.reduce((sum, s) => sum + s.amountFcfa, 0)
    expect(spilloverTotal).toBeGreaterThanOrEqual(40)
  })

  test('Pas de perte de FCFA — somme allocations = totalCommission', () => {
    const result = calculateCommissions(makeInput())
    const sum = result.allocations.reduce((s, a) => s + a.amountFcfa, 0)
    expect(sum).toBe(result.totalCommission)
  })
})

describe('Commission Engine — Taux variables', () => {
  test('Transport < 500 FCFA @ 3% → calcul correct', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 400, commissionRate: 0.03 }))
    expect(result.totalCommission).toBe(12)   // 400 * 0.03
    expect(result.platformFee).toBe(5)         // floor(12 * 0.45)
  })

  test('Transport 500-2000 FCFA @ 4%', () => {
    const result = calculateCommissions(makeInput({ amountFcfa: 1000, commissionRate: 0.04 }))
    expect(result.totalCommission).toBe(40)
  })
})

describe('Commission Engine — Sécurité', () => {
  test('Rejet si transactionId est vide', () => {
    expect(() => calculateCommissions(makeInput({ transactionId: '' }))).toThrow('transactionId')
  })

  test('Rejet si buyerId est vide', () => {
    expect(() => calculateCommissions(makeInput({ buyerId: '' }))).toThrow('buyerId')
  })
})

describe('Scénario Kofi — Réseau 3^5 niveaux', () => {
  test('Commissions mensuelles Kofi ≈ 234 750 FCFA/mois', () => {
    // Réseau : Kofi a 3 recrues directes, chacune recrute 3, sur 5 niveaux
    // Dépenses : 130 000 FCFA/mois/personne, taux commission 10%
    const monthly = estimateMonthlyKingmakerCommissions({
      directRecruits: 3,
      branchingFactor: 3,
      avgMonthlySpend: 130_000,
      commissionRate: 0.10,
      levels: 5,
    })

    // La valeur exacte dépend des arrondis, tolérance de ±5%
    const expected = 234_750
    const tolerance = expected * 0.05
    expect(monthly).toBeGreaterThanOrEqual(expected - tolerance)
    expect(monthly).toBeLessThanOrEqual(expected + tolerance)
  })

  test('Réseau 3^5 = 363 personnes totales', () => {
    let total = 0
    for (let l = 1; l <= 5; l++) {
      total += Math.pow(3, l)
    }
    expect(total).toBe(363)
  })
})
