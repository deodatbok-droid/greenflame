import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/demo/data'

const L1_EMAILS = [
  'demo-l1-1@greenflameafrica.com',
  'demo-l1-2@greenflameafrica.com',
  'demo-l1-3@greenflameafrica.com',
  'demo-l1-4@greenflameafrica.com',
  'demo-l1-5@greenflameafrica.com',
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const svc = createServiceClient()
  const uid = user.id

  // Récupérer les IDs de TOUS les membres de l'arbre (L1 à L5)
  const { data: fakeMembers } = await svc
    .from('network_tree')
    .select('user_id')
    .or(`l1_upline.eq.${uid},l2_upline.eq.${uid},l3_upline.eq.${uid},l4_upline.eq.${uid},l5_upline.eq.${uid}`)

  const fakeMemberIds = [...new Set((fakeMembers ?? []).map(m => m.user_id).filter(Boolean))]

  // Supprimer les données des faux membres
  if (fakeMemberIds.length > 0) {
    await Promise.all([
      svc.from('leader_career_ranks').delete().in('user_id', fakeMemberIds),
      svc.from('merchants').delete().in('user_id', fakeMemberIds),
      svc.from('network_tree').delete().in('user_id', fakeMemberIds),
      svc.from('users').delete().in('id', fakeMemberIds),
    ])
    // Supprimer les comptes auth des faux membres
    await Promise.all(
      fakeMemberIds.map(id => svc.auth.admin.deleteUser(id).catch(() => {}))
    )
  }

  // Supprimer les comptes L1 par email (fallback si network_tree était vide après un seed échoué)
  await Promise.all(L1_EMAILS.map(async email => {
    const { data } = await svc.auth.admin.generateLink({ type: 'recovery', email })
    const authId = (data as { user?: { id: string } } | null)?.user?.id
    if (authId && !fakeMemberIds.includes(authId)) {
      await svc.auth.admin.deleteUser(authId).catch(() => {})
    }
  }))

  // Supprimer les données du compte démo
  await Promise.all([
    svc.from('kyc_submissions').delete().eq('user_id', uid),
    svc.from('transactions').delete().or(`buyer_id.eq.${uid},merchant_id.eq.${uid}`),
    svc.from('commission_distributions').delete().eq('recipient_id', uid),
    svc.from('network_tree').delete().eq('user_id', uid),
    svc.from('leader_career_ranks').delete().eq('user_id', uid),
  ])

  // Wallet : récupérer l'id pour supprimer les entrées ledger
  const { data: wallet } = await svc.from('wallets').select('id').eq('user_id', uid).maybeSingle()
  if (wallet?.id) {
    await svc.from('wallet_ledger').delete().eq('wallet_id', wallet.id)
    await svc.from('wallets').delete().eq('id', wallet.id)
  }

  // Merchant wallet
  const { data: merchant } = await svc.from('merchants').select('id').eq('user_id', uid).maybeSingle()
  if (merchant?.id) {
    const { data: mw } = await svc.from('merchant_wallets').select('id').eq('merchant_id', merchant.id).maybeSingle()
    if (mw?.id) {
      try { await svc.from('merchant_wallet_ledger').delete().eq('merchant_wallet_id', mw.id) } catch { /* ignore */ }
      await svc.from('merchant_wallets').delete().eq('id', mw.id)
    }
    await svc.from('products').delete().eq('merchant_id', merchant.id)
    await svc.from('merchants').delete().eq('id', merchant.id)
  }

  await svc.from('users').delete().eq('id', uid)

  return NextResponse.json({ ok: true })
}
