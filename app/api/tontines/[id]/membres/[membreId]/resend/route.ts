import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken, inviteExpiryDate, notifyTontineInvite } from '@/lib/tontine/invite'

interface RouteParams {
  params: Promise<{ id: string; membreId: string }>
}

// POST — relance l'invitation d'un membre (nouveau token, nouvelle expiration 7j,
// renvoi WhatsApp/SMS). Réservé au créateur de la tontine. Utile aussi bien pour
// un lien expiré que pour un simple rappel avant expiration.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id, membreId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: tontine } = await supabase
    .from('tontines')
    .select('id, name')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: membre, error: mErr } = await supabase
    .from('tontine_membres')
    .select('id, full_name, phone, status')
    .eq('id', membreId)
    .eq('tontine_id', id)
    .single()

  if (mErr || !membre) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  if (membre.status === 'active') {
    return NextResponse.json({ error: 'Ce membre a déjà validé son invitation' }, { status: 400 })
  }
  if (!membre.phone) {
    return NextResponse.json({ error: 'Ce membre n\'a pas de numéro de téléphone enregistré' }, { status: 400 })
  }

  const inviteToken = generateInviteToken()

  const { data, error } = await supabase
    .from('tontine_membres')
    .update({
      status: 'pending',
      invite_token: inviteToken,
      invite_expires_at: inviteExpiryDate(),
    })
    .eq('id', membreId)
    .eq('tontine_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: creatorProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()

  void notifyTontineInvite({
    phone: membre.phone,
    memberFirstName: membre.full_name?.split(' ')[0] ?? membre.full_name,
    tontineName: tontine.name,
    creatorName: creatorProfile?.full_name ?? 'Un membre GreenFlame',
    token: inviteToken,
    resend: true,
  })

  return NextResponse.json(data)
}
