export type MoMoOperator = 'mtn_momo' | 'moov_money' | 'celtiis'
export type MoMoStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED'

export interface RequestToPayInput {
  amount: number           // en FCFA
  currency: 'XOF'
  externalId: string       // idempotency key
  payerMsisdn: string      // numero du payeur (format international : 22961...)
  payerMessage: string
  payeeNote: string
  callbackUrl?: string
}

export interface RequestToPayResult {
  referenceId: string      // UUID de la transaction operateur
  status: MoMoStatus
  externalId: string
  amount: number
  currency: string
  error?: string
}

export interface TransferInput {
  amount: number
  currency: 'XOF'
  externalId: string
  payeeMsisdn: string      // numero du destinataire
  payerMessage: string
  payeeNote: string
}

export interface MoMoAdapter {
  operator: MoMoOperator
  requestToPay(input: RequestToPayInput): Promise<RequestToPayResult>
  getTransactionStatus(referenceId: string): Promise<RequestToPayResult>
  transfer?(input: TransferInput): Promise<RequestToPayResult>
}
