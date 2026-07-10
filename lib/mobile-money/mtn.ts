// Adaptateur MTN MoMo — Production
// Documentation : https://momodeveloper.mtn.com
// Activer en mettant PAYMENT_MODE=live dans .env.local

import type { MoMoAdapter, RequestToPayInput, RequestToPayResult, TransferInput } from './types'

const MTN_BASE_URL = {
  sandbox: 'https://sandbox.momodeveloper.mtn.com',
  production: 'https://proxy.momoapi.mtn.com',
}

async function getAccessToken(product: 'collection' | 'disbursement' = 'collection'): Promise<string> {
  const env = (process.env.MTN_MOMO_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox'
  const baseUrl = MTN_BASE_URL[env]

  const isDisb = product === 'disbursement'
  const apiUser = isDisb ? process.env.MTN_MOMO_DISBURSEMENT_API_USER : process.env.MTN_MOMO_API_USER
  const apiKey  = isDisb ? process.env.MTN_MOMO_DISBURSEMENT_API_KEY  : process.env.MTN_MOMO_API_KEY
  const subKey  = isDisb ? process.env.MTN_MOMO_DISBURSEMENT_SUB_KEY  : process.env.MTN_MOMO_SUBSCRIPTION_KEY

  const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString('base64')

  const response = await fetch(`${baseUrl}/${product}/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': subKey!,
    },
  })

  if (!response.ok) {
    throw new Error(`MTN MoMo auth failed (${product}): ${response.status}`)
  }

  const data = await response.json()
  return data.access_token as string
}

export const mtnMoMoLive: MoMoAdapter = {
  operator: 'mtn_momo',

  async requestToPay(input: RequestToPayInput): Promise<RequestToPayResult> {
    const env = (process.env.MTN_MOMO_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox'
    const baseUrl = MTN_BASE_URL[env]
    const accessToken = await getAccessToken()
    const referenceId = crypto.randomUUID()

    const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': env,
        'X-Callback-Url': input.callbackUrl ?? process.env.MTN_MOMO_CALLBACK_URL ?? '',
        'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount.toString(),
        currency: input.currency,
        externalId: input.externalId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: input.payerMsisdn,
        },
        payerMessage: input.payerMessage,
        payeeNote: input.payeeNote,
      }),
    })

    if (response.status !== 202) {
      const error = await response.text()
      throw new Error(`MTN requestToPay failed: ${response.status} — ${error}`)
    }

    return {
      referenceId,
      status: 'PENDING',
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
    }
  },

  async getTransactionStatus(referenceId: string): Promise<RequestToPayResult> {
    const env = (process.env.MTN_MOMO_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox'
    const baseUrl = MTN_BASE_URL[env]
    const accessToken = await getAccessToken()

    const response = await fetch(
      `${baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Target-Environment': env,
          'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY!,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`MTN getTransactionStatus failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      referenceId,
      status: data.status as RequestToPayResult['status'],
      externalId: data.externalId,
      amount: parseFloat(data.amount),
      currency: data.currency,
      error: data.reason,
    }
  },

  async transfer(input: TransferInput): Promise<RequestToPayResult> {
    const env = (process.env.MTN_MOMO_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox'
    const baseUrl = MTN_BASE_URL[env]
    const accessToken = await getAccessToken('disbursement')
    const referenceId = crypto.randomUUID()

    const response = await fetch(`${baseUrl}/disbursement/v1_0/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': env,
        'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_DISBURSEMENT_SUB_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount.toString(),
        currency: input.currency,
        externalId: input.externalId,
        payee: {
          partyIdType: 'MSISDN',
          partyId: input.payeeMsisdn,
        },
        payerMessage: input.payerMessage,
        payeeNote: input.payeeNote,
      }),
    })

    if (response.status !== 202) {
      throw new Error(`MTN transfer failed: ${response.status}`)
    }

    return {
      referenceId,
      status: 'PENDING',
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
    }
  },
}
