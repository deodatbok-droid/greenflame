import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken, inviteExpiryDate, notifyTontineInvite } from '@/lib/tontine/invite'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tontine_membres')
    .select('*, tontine_cotisations(*)')
    .eq('tontine_id', id)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

interface PostBody {
  full_name: string
  phone?: string
  position?: number
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // verify creator
  const { data: tontine } = await supabase
    .from('tontines')
    .select('id, creator_id, name')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body: PostBody = await req.json()

  let position = body.position
  if (!position) {
    const { data: existing } = await supabase
      .from('tontine_membres')
      .select('position')
      .eq('tontine_id', id)
      .order('position', { ascending: false })
      .limit(1)
    position = existing && existing.length > 0 ? existing[0].position + 1 : 1
  }

  const inviteToken = generateInviteToken()

  const { data, error } = await supabase
    .from('tontine_membres')
    .insert({
      tontine_id: id,
      full_name: body.full_name,
      phone: body.phone ?? null,
      position,
      is_admin: false,
      user_id: null,
      status: 'pending',
      invite_token: inviteToken,
      invite_expires_at: inviteExpiryDate(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.phone) {
    const { data: creatorProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
    void notifyTontineInvite({
      phone: body.phone,
      memberFirstName: body.full_name?.split(' ')[0] ?? body.full_name,
      tontineName: tontine.name,
      creatorName: creatorProfile?.full_name ?? 'Un membre GreenFlame',
      token: inviteToken,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
