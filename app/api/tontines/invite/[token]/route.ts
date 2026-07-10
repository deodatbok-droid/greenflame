import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET — informations publiques de l'invitation (pas d'authentification requise),
// pour afficher la page /tontine/invite/[token] avant que la personne se connecte.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 })

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('tontine_membres')
    .select(`
      id, full_name, status, invite_expires_at,
      tontines ( id, name, contribution_amount_fcfa, frequency, creator_id )
    `)
    .eq('invite_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })

  const tontine = Array.isArray(data.tontines) ? data.tontines[0] : data.tontines
  if (!tontine) return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })

  const { data: creatorProfile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', tontine.creator_id)
    .single()

  const expired = data.status === 'expired' ||
    (data.invite_expires_at ? new Date(data.invite_expires_at) < new Date() : false)

  return NextResponse.json({
    membre_full_name: data.full_name,
    status: data.status,
    expired,
    tontine: {
      name: tontine.name,
      contribution_amount_fcfa: tontine.contribution_amount_fcfa,
      frequency: tontine.frequency,
      creator_name: creatorProfile?.full_name ?? null,
    },
  })
}

// POST — valide l'invitation : nécessite d'être authentifié (compte GreenFlame),
// lie user_id à la ligne membre, passe le statut à 'active', invalide le token.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })

  const svc = createServiceClient()

  const { data: membre, error: mErr } = await svc
    .from('tontine_membres')
    .select('id, tontine_id, status, invite_expires_at, user_id')
    .eq('invite_token', token)
    .single()

  if (mErr || !membre) return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })

  if (membre.status === 'active') {
    // Idempotent : déjà validé (par cet utilisateur ou rejoué) — pas une erreur.
    return NextResponse.json({ success: true, tontine_id: membre.tontine_id, already_validated: true })
  }

  const expired = membre.status === 'expired' ||
    (membre.invite_expires_at ? new Date(membre.invite_expires_at) < new Date() : false)

  if (expired) {
    await svc.from('tontine_membres').update({ status: 'expired' }).eq('id', membre.id)
    return NextResponse.json(
      { error: 'Ce lien d\'invitation a expiré. Demandez à l\'administrateur de la tontine de vous renvoyer une invitation.' },
      { status: 410 },
    )
  }

  const { data, error } = await svc
    .from('tontine_membres')
    .update({
      user_id: user.id,
      status: 'active',
      invite_token: null,
      invite_expires_at: null,
    })
    .eq('id', membre.id)
    .select('id, tontine_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, tontine_id: data.tontine_id })
}
