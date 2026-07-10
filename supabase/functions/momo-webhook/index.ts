// Edge Function : momo-webhook
// Reçoit les callbacks de confirmation de MTN MoMo et Moov Money
// Déclenche la distribution des commissions si le paiement est confirmé

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let webhookData: Record<string, unknown>
  try {
    webhookData = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Normaliser selon l'opérateur
  const operator = req.headers.get('X-MoMo-Operator') ?? 'mtn_momo'

  let referenceId: string
  let status: string
  let externalId: string

  if (operator === 'mtn_momo') {
    referenceId = webhookData.referenceId as string
    status = webhookData.status as string
    externalId = webhookData.externalId as string
  } else {
    // Moov Money
    referenceId = webhookData.transactionId as string
    status = webhookData.status as string
    externalId = webhookData.orderId as string
  }

  if (!referenceId || !status || !externalId) {
    return new Response('Missing fields', { status: 400 })
  }

  // Retrouver la transaction via idempotency_key (= externalId)
  const { data: transaction } = await supabase
    .from('transactions')
    .select('id, status')
    .eq('idempotency_key', externalId)
    .single()

  if (!transaction) {
    console.warn(`Webhook: transaction not found for externalId=${externalId}`)
    return new Response('Transaction not found', { status: 404 })
  }

  // Enregistrer la référence externe
  await supabase
    .from('transactions')
    .update({ payment_reference: referenceId })
    .eq('id', transaction.id)

  // Enregistrer dans mobile_money_ops
  await supabase.from('mobile_money_ops').update({
    status: status === 'SUCCESSFUL' ? 'success' : 'failed',
    external_reference: referenceId,
    updated_at: new Date().toISOString(),
  }).eq('external_reference', externalId)

  if (status !== 'SUCCESSFUL') {
    // Paiement échoué → marquer la transaction failed
    await supabase
      .from('transactions')
      .update({ status: 'failed' })
      .eq('id', transaction.id)

    console.log(`Transaction ${transaction.id} marked failed (MoMo status: ${status})`)
  } else {
    console.log(`Transaction ${transaction.id} confirmed via MoMo webhook`)
  }

  return new Response('OK', { status: 200 })
})
