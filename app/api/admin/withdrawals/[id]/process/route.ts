import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMoMoAdapter } from '@/lib/mobile-money/mock'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth — admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const svc = createServiceClient()

  const { data: withdrawal } = await svc
    .from('withdrawal_requests')
    .select('id, user_id, amount_fcfa, currency_type, operator, phone, status, source, merchant_id')
    .eq('id', id)
    .single()

  if (!withdrawal) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (withdrawal.status !== 'pending') {
    return NextResponse.json({ error: 'Demande deja traitee' }, { status: 409 })
  }

  const body: { action: 'approve' | 'reject'; note?: string } = await req.json()

  if (body.action === 'reject') {
    // Remboursement selon la source
    if (withdrawal.source === 'merchant' && withdrawal.merchant_id) {
      // Retrait boutique → rembourser merchant_wallets
      await svc.rpc('merchant_wallet_credit', {
        p_merchant_id:  withdrawal.merchant_id,
        p_amount_fcfa:  withdrawal.amount_fcfa,
        p_type:         'admin_adjustment',
        p_notes:        `Remboursement retrait refusé : ${body.note ?? 'Refusé par admin'}`,
      })
    } else {
      // Retrait perso → rembourser wallets
      const fcfaBack = withdrawal.currency_type === 'fcfa' ? withdrawal.amount_fcfa : 0
      const gfpBack  = withdrawal.currency_type === 'gfp'  ? withdrawal.amount_fcfa : 0
      await svc.rpc('wallet_credit', {
        p_user_id: withdrawal.user_id,
        p_amount_fcfa: fcfaBack,
        p_amount_gfp: gfpBack,
        p_total_earned: 0,
      })
    }

    await svc.from('withdrawal_requests').update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      admin_note: body.note ?? 'Refuse par admin',
    }).eq('id', id)

    insertNotification({
      userId:      withdrawal.user_id,
      type:        'withdrawal_rejected',
      title:       '❌ Retrait refusé',
      body:        `Votre demande de retrait de ${withdrawal.amount_fcfa.toLocaleString('fr-FR')} FCFA a été refusée.${body.note ? ` Motif : ${body.note}` : ' Les fonds ont été recrédités sur votre wallet.'}`,
      referenceId: id,
    }).catch(() => {})

    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  // Approve — call MTN MoMo Disbursement
  try {
    const adapter = getMoMoAdapter(withdrawal.operator as 'mtn_momo' | 'moov_money')

    if (!adapter.transfer) {
      throw new Error(`Transfert non supporte pour ${withdrawal.operator}`)
    }

    const result = await adapter.transfer({
      amount: withdrawal.amount_fcfa,
      currency: 'XOF',
      externalId: withdrawal.id,
      payeeMsisdn: withdrawal.phone.replace('+', ''),
      payerMessage: 'Retrait GreenFlame',
      payeeNote: `Retrait ${withdrawal.currency_type.toUpperCase()} #${withdrawal.id.slice(0, 8)}`,
    })

    const isSuccess = result.status === 'SUCCESSFUL'
    await svc.from('withdrawal_requests').update({
      status: isSuccess ? 'completed' : 'processing',
      payment_reference: result.referenceId,
      processed_at: isSuccess ? new Date().toISOString() : null,
    }).eq('id', id)

    insertNotification({
      userId:      withdrawal.user_id,
      type:        isSuccess ? 'withdrawal_completed' : 'withdrawal_processing',
      title:       isSuccess ? '✅ Retrait en cours d\'envoi' : '⏳ Retrait en traitement',
      body:        isSuccess
        ? `Votre retrait de ${withdrawal.amount_fcfa.toLocaleString('fr-FR')} FCFA est en cours d'envoi vers votre compte Mobile Money.`
        : `Votre retrait de ${withdrawal.amount_fcfa.toLocaleString('fr-FR')} FCFA est en cours de traitement. Vous serez notifié dès réception.`,
      referenceId: id,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      action: 'approved',
      referenceId: result.referenceId,
      status: result.status,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
