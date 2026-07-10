import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/wasender'

// ── Helpers ──────────────────────────────────────────────
async function isAdmin(userId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc.from('users').select('role').eq('id', userId).single()
  return !!(data?.role?.includes('admin') || data?.role?.includes('platform_upline'))
}

// ── GET — liste des bulletins ─────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = await isAdmin(user.id)
  const svc   = createServiceClient()

  // Admins : vue registre complète
  if (admin) {
    const { data, error } = await svc
      .from('ucp_registry')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subscriptions: data })
  }

  // Utilisateur : ses propres bulletins
  const { data, error } = await svc
    .from('ucp_subscriptions')
    .select(
      'id, bsd_number, status, subscription_type, ucp_parts, amount_fcfa, ' +
      'pdf_url, created_at, accepted_at, otp_verified_at, pin_verified_at, confirmed_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscriptions: data })
}

// ── POST — émission par admin ─────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await isAdmin(user.id)))
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { user_id, subscription_type, ucp_parts, prix_unitaire_fcfa, amount_fcfa, notes } = await req.json()

  if (!user_id || !subscription_type || !ucp_parts)
    return NextResponse.json({ error: 'user_id, subscription_type et ucp_parts requis' }, { status: 400 })

  if (!['purchase', 'attribution'].includes(subscription_type))
    return NextResponse.json({ error: 'subscription_type invalide' }, { status: 400 })

  if (subscription_type === 'purchase' && (!prix_unitaire_fcfa || Number(prix_unitaire_fcfa) <= 0))
    return NextResponse.json({ error: 'prix_unitaire_fcfa requis pour une souscription par achat' }, { status: 400 })

  const svc = createServiceClient()

  const { data: beneficiary } = await svc
    .from('users')
    .select('id, full_name, phone')
    .eq('id', user_id)
    .single()

  if (!beneficiary)
    return NextResponse.json({ error: 'Bénéficiaire introuvable' }, { status: 404 })

  const partsCount    = Number(ucp_parts)
  const prixUnitaire  = subscription_type === 'attribution' ? 0 : Number(prix_unitaire_fcfa ?? 0)
  // amount_fcfa = parts × prix_unitaire (source of truth, pas le champ libre)
  const montantTotal  = subscription_type === 'attribution' ? 0 : partsCount * prixUnitaire

  const { data, error } = await svc.from('ucp_subscriptions').insert({
    user_id,
    issued_by:           user.id,
    subscription_type,
    ucp_parts:           partsCount,
    prix_unitaire_fcfa:  prixUnitaire,
    amount_fcfa:         montantTotal,
    notes:               notes ?? null,
    status:              'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification WhatsApp
  if (beneficiary.phone) {
    const msg = subscription_type === 'attribution'
      ? `🎉 *GreenFlame* — Félicitations !\n\nVous avez reçu une attribution de *${partsCount} part(s) UCP* (Ubuntu Capital Plan) dans le cadre de votre engagement comme Leader GreenFlame.\n\nConnectez-vous pour consulter et signer votre Bulletin *${data.bsd_number}*.\n\n➡ greenflame.africa/ucp`
      : `📋 *GreenFlame* — Un Bulletin de Souscription UCP (*${data.bsd_number}*) vous a été émis pour *${partsCount} part(s)* à *${prixUnitaire.toLocaleString('fr-FR')} FCFA/part* — total : *${montantTotal.toLocaleString('fr-FR')} FCFA*.\n\nConnectez-vous pour signer votre bulletin.\n\n➡ greenflame.africa/ucp`
    sendWhatsApp(beneficiary.phone, msg).catch(() => {})
  }

  return NextResponse.json({ ok: true, subscription: data })
}
