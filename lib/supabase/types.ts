// Types TypeScript pour la base de donnees GreenFlame
// Regenerer avec : npm run supabase:gen-types

export type UserRole =
  | 'consumer'
  | 'merchant'
  | 'kingmaker'
  | 'kingmaker_stockiste'
  | 'admin'
  | 'platform_upline'

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
export type PaymentMethod = 'mtn_momo' | 'moov_money' | 'celtiis' | 'wallet_gf' | 'cash_confirmed'
export type DistributionType = 'platform' | 'cashback' | 'network' | 'spillover'
export type CurrencyType = 'fcfa' | 'gfp'
export type WalletTxType =
  | 'cashback'
  | 'commission_network'
  | 'platform_fee'
  | 'mobile_money_deposit'
  | 'mobile_money_withdrawal'
  | 'purchase_payment'
  | 'gfp_conversion'
  | 'spillover'
  | 'refund'

export interface User {
  id: string
  phone: string
  full_name: string
  role: UserRole[]
  upline_id: string | null
  referral_code: string
  is_active: boolean
  last_active_at: string
  kyc_level: number
  country_code: string
  created_at: string
}

export interface Wallet {
  id: string
  user_id: string
  balance_fcfa: number
  balance_gfp: number
  locked_balance: number
  total_earned_fcfa: number
  total_spent_fcfa: number
  updated_at: string
}

export interface WalletSummary {
  id: string
  user_id: string
  full_name: string
  phone: string
  role: UserRole[]
  balance_fcfa: number
  balance_gfp: number
  total_earned_fcfa: number
  total_spent_fcfa: number
  updated_at: string
}

export interface Merchant {
  id: string
  user_id: string
  business_name: string
  business_category: string
  commission_rate: number
  address_text: string | null
  latitude: number | null
  longitude: number | null
  qr_code_url: string | null
  is_verified: boolean
  is_active: boolean
  onboarded_by: string | null
  total_gmv: number
  created_at: string
}

export interface Transaction {
  id: string
  merchant_id: string
  buyer_id: string
  amount_fcfa: number
  commission_total: number
  commission_rate: number
  status: TransactionStatus
  payment_method: PaymentMethod | null
  payment_reference: string | null
  idempotency_key: string | null
  metadata: Record<string, unknown>
  created_at: string
  completed_at: string | null
}

export interface CommissionDistribution {
  id: string
  transaction_id: string
  recipient_id: string | null
  level: number
  amount_fcfa: number
  percentage: number
  distribution_type: DistributionType
  is_gfp: boolean
  created_at: string
}

export interface WalletLedgerEntry {
  id: string
  wallet_id: string
  amount: number
  currency_type: CurrencyType
  transaction_type: WalletTxType
  reference_id: string | null
  balance_after: number
  created_at: string
}

export interface NetworkTree {
  user_id: string
  l1_upline: string | null
  l2_upline: string | null
  l3_upline: string | null
  l4_upline: string | null
  l5_upline: string | null
  depth: number
  tree_path: string[]
  updated_at: string
}

export interface MerchantCategory {
  id: string
  code: string
  name_fr: string
  commission_rate: number
  min_ticket_fcfa: number
  max_ticket_fcfa: number | null
  notes: string | null
}

export interface SpilloverFund {
  id: string
  transaction_id: string
  amount_fcfa: number
  reason: 'orphan_level' | 'inactive_kingmaker' | 'chain_too_short' | 'rounding'
  created_at: string
}

export interface MerchantTodayStats {
  merchant_id: string
  business_name: string
  user_id: string
  tx_count_today: number
  gmv_today: number
  commission_today: number
}

// Type enrichi pour l'UI marchand (avec client credit alert)
export interface TransactionWithBuyerCredit extends Transaction {
  buyer?: Pick<User, 'id' | 'full_name' | 'phone'>
  buyer_wallet_balance?: number  // solde disponible de l'acheteur (pour alerte Jour 30)
}
