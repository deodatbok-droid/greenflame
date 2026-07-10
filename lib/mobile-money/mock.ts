// Adaptateur mock pour le developpement et les tests
// Simule les reponses de MTN MoMo et Moov Money
// Remplacer par les vrais adaptateurs en production

import type { MoMoAdapter, RequestToPayInput, RequestToPayResult, TransferInput } from './types'

const pendingTransactions = new Map<string, RequestToPayResult>()

// Simule un delai reseau
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Genere un UUID simple pour les tests
function mockUUID() {
  return 'mock-' + Math.random().toString(36).slice(2, 11)
}

export const mtnMoMoMock: MoMoAdapter = {
  operator: 'mtn_momo',

  async requestToPay(input: RequestToPayInput): Promise<RequestToPayResult> {
    await delay(500) // simule latence reseau

    const referenceId = mockUUID()
    const result: RequestToPayResult = {
      referenceId,
      status: 'PENDING',
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
    }

    // Stocke en memoire (en prod, l'operateur envoie un webhook)
    pendingTransactions.set(referenceId, result)

    // Simule la confirmation asynchrone apres 2 secondes
    setTimeout(() => {
      const successRate = 0.95 // 95% de succes en mock
      const isSuccess = Math.random() < successRate
      pendingTransactions.set(referenceId, {
        ...result,
        status: isSuccess ? 'SUCCESSFUL' : 'FAILED',
        error: isSuccess ? undefined : 'PAYER_NOT_FOUND',
      })
    }, 2000)

    return result
  },

  async getTransactionStatus(referenceId: string): Promise<RequestToPayResult> {
    await delay(200)

    const stored = pendingTransactions.get(referenceId)
    if (!stored) {
      return {
        referenceId,
        status: 'FAILED',
        externalId: '',
        amount: 0,
        currency: 'XOF',
        error: 'REFERENCE_NOT_FOUND',
      }
    }
    return stored
  },

  async transfer(input: TransferInput): Promise<RequestToPayResult> {
    await delay(500)
    return {
      referenceId: mockUUID(),
      status: 'SUCCESSFUL',
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
    }
  },
}

export const moovMoneyMock: MoMoAdapter = {
  operator: 'moov_money',

  async requestToPay(input: RequestToPayInput): Promise<RequestToPayResult> {
    await delay(600)
    const referenceId = mockUUID()
    const result: RequestToPayResult = {
      referenceId,
      status: 'PENDING',
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
    }
    pendingTransactions.set(referenceId, result)
    setTimeout(() => {
      pendingTransactions.set(referenceId, { ...result, status: 'SUCCESSFUL' })
    }, 2500)
    return result
  },

  async getTransactionStatus(referenceId: string): Promise<RequestToPayResult> {
    await delay(200)
    return pendingTransactions.get(referenceId) ?? {
      referenceId,
      status: 'FAILED',
      externalId: '',
      amount: 0,
      currency: 'XOF',
      error: 'NOT_FOUND',
    }
  },
}

// Factory : retourne l'adaptateur correct selon l'operateur et l'environnement
export function getMoMoAdapter(operator: 'mtn_momo' | 'moov_money'): MoMoAdapter {
  const isMock = process.env.PAYMENT_MODE !== 'live'

  if (isMock) {
    return operator === 'mtn_momo' ? mtnMoMoMock : moovMoneyMock
  }

  const { mtnMoMoLive } = require('./mtn')
  if (operator === 'mtn_momo') return mtnMoMoLive
  // Moov Money live non implémenté — erreur explicite plutôt que fallback silencieux
  // (le mock ne fonctionne pas en serverless : setTimeout ne survit pas à la fin de la requête)
  throw new Error(
    '[GreenFlame] Moov Money live adapter not implemented. ' +
    'Set PAYMENT_MODE=mock for development, or implement lib/mobile-money/moov.ts for production.'
  )
}
