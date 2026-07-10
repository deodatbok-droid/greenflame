export interface NetworkUplines {
  l1?: string | null  // user_id du kingmaker L1
  l2?: string | null
  l3?: string | null
  l4?: string | null
  l5?: string | null
}

export interface ActiveStatus {
  userId: string
  isActive: boolean
  lastActiveAt: Date
}

export interface CommissionInput {
  transactionId: string
  amountFcfa: number           // montant total de la transaction (en FCFA, pas centimes)
  commissionRate: number       // taux de commission du marchand (ex: 0.10)
  buyerId: string
  merchantId: string
  uplines: NetworkUplines
  activeStatuses: Record<string, boolean>  // userId → is active
}

export interface CommissionAllocation {
  recipientId: string | null   // null = spillover fund, platform, ou rewards_fund
  level: number                // 0=platform, 1-5=reseau, 6=cashback, 7=spillover, 8=rewards_fund
  amountFcfa: number
  percentage: number
  distributionType: 'platform' | 'cashback' | 'network' | 'spillover' | 'rewards_fund'
  isGfp: boolean               // si true → crediter en GFP, pas FCFA
  spilloverReason?: 'orphan_level' | 'inactive_kingmaker' | 'rounding_remainder'
}

export interface CommissionResult {
  transactionId: string
  totalCommission: number      // commission totale prelevee au marchand
  commissionRate: number
  platformFee: number          // 45% de la commission
  cashbackAmount: number       // 12% de la commission
  cashbackIsGfp: boolean       // true si cashback < seuil GFP
  rewardsFundAmount: number    // 3%  de la commission → Fonds Récompenses/Événements
  networkPool: number          // 40% de la commission
  spilloverAmount: number      // montant vers spillover fund
  allocations: CommissionAllocation[]
}
