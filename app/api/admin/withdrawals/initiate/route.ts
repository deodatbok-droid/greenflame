import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  // Vérification admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = caller?.role?.includes('admin') || caller?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { targetUserId, amountFcfa, operator, phone, note } = await req.json()
  if (!targetUserId || !amountFcfa || !operator || !phone)
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  if (!['mtn_momo', 'moov_money'].includes(operator))
    return NextResponse.json({ error: 'Opérateur invalide' }, { status: 400 })

  const svc = createServiceClient()

  // Vérifier que l'utilisateur a assez de solde
  const { data: wallet } = await svc.from('wallets').select('balance_fcfa').eq('user_id', targetUserId).single()
  if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 })
  if (wallet.balance_fcfa < amountFcfa)
    return NextResponse.json({ error: `Solde insuffisant (${wallet.balance_fcfa} FCFA disponible)` }, { status: 400 })

  // Créer la demande en attente de validation utilisateur (sans débiter le wallet)
  const { data: request, error } = await svc.from('withdrawal_requests').insert({
    user_id: targetUserId,
    amount_fcfa: amountFcfa,
    currency_type: 'fcfa',
    operator,
    phone,
    status: 'pending_user_validation',
    initiated_by: user.id,
    admin_note: note ?? null,
    source: 'personal',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  insertNotification({
    userId:      targetUserId,
    type:        'withdrawal_validation_required',
    title:       '⚠️ Validation de retrait requise',
    body:        `Un retrait de ${amountFcfa.toLocaleString('fr-FR')} FCFA a été initié par l'administration. Ouvrez votre wallet pour valider ou refuser l'opération avec votre code PIN.`,
    referenceId: request.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true, requestId: request.id })
}
