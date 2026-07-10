import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken, inviteExpiryDate, notifyTontineInvite } from '@/lib/tontine/invite'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tontines')
    .select('*, tontine_membres(*, tontine_cotisations(*))')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

interface MembreInput {
  full_name: string
  phone?: string
  position?: number
}

interface CreateTontineBody {
  name: string
  description?: string
  contribution_amount_fcfa: number
  frequency: string
  start_date?: string
  notes?: string
  type?: 'cash' | 'produit'
  membres: MembreInput[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body: CreateTontineBody = await req.json()
  const { name, description, contribution_amount_fcfa, frequency, start_date, notes, type, membres } = body

  if (!name || !contribution_amount_fcfa || !frequency) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const { data: tontine, error: tErr } = await supabase
    .from('tontines')
    .insert({
      creator_id: user.id,
      name,
      description: description ?? null,
      contribution_amount_fcfa,
      frequency,
      start_date: start_date ?? new Date().toISOString().split('T')[0],
      notes: notes ?? null,
      type: type ?? 'cash',
    })
    .select()
    .single()

  if (tErr || !tontine) return NextResponse.json({ error: tErr?.message ?? 'Erreur création' }, { status: 500 })

  if (membres && membres.length > 0) {
    const membresInsert = membres.map((m, i) => {
      // Le créateur (index 0) est immédiatement actif et lié à son compte.
      // Les autres membres restent "pending" jusqu'à validation de leur invitation.
      if (i === 0) {
        return {
          tontine_id: tontine.id,
          full_name: m.full_name,
          phone: m.phone ?? null,
          position: m.position ?? i + 1,
          is_admin: true,
          user_id: user.id,
          status: 'active' as const,
        }
      }
      return {
        tontine_id: tontine.id,
        full_name: m.full_name,
        phone: m.phone ?? null,
        position: m.position ?? i + 1,
        is_admin: false,
        user_id: null,
        status: 'pending' as const,
        invite_token: generateInviteToken(),
        invite_expires_at: inviteExpiryDate(),
      }
    })

    const { data: insertedMembres, error: mErr } = await supabase
      .from('tontine_membres')
      .insert(membresInsert)
      .select('id, full_name, phone, invite_token, status')
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    const { data: creatorProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
    const creatorName = creatorProfile?.full_name ?? 'Un membre GreenFlame'

    for (const m of insertedMembres ?? []) {
      if (m.status === 'pending' && m.invite_token && m.phone) {
        void notifyTontineInvite({
          phone: m.phone,
          memberFirstName: m.full_name?.split(' ')[0] ?? m.full_name,
          tontineName: name,
          creatorName,
          token: m.invite_token,
        })
      }
    }
  }

  const { data: full, error: fErr } = await supabase
    .from('tontines')
    .select('*, tontine_membres(*, tontine_cotisations(*))')
    .eq('id', tontine.id)
    .single()

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  return NextResponse.json(full, { status: 201 })
}
