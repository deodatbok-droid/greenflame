import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordFlammeEvent } from '@/lib/flamme/engine'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periode = searchParams.get('periode')

  let query = supabase
    .from('tontine_cotisations')
    .select('*, tontine_membres(id, full_name, position)')
    .eq('tontine_id', id)
    .order('created_at', { ascending: false })

  if (periode) query = query.eq('periode', periode)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

interface PostBody {
  membre_id: string
  periode: string
  amount_fcfa: number
  late_fee_fcfa?: number
  status?: string
  notes?: string
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // verify creator
  const { data: tontine } = await supabase
    .from('tontines')
    .select('id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body: PostBody = await req.json()
  const { membre_id, periode, amount_fcfa, late_fee_fcfa, status, notes } = body

  if (!membre_id || !periode) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const finalStatus = status ?? 'en_attente'

  const { data, error } = await supabase
    .from('tontine_cotisations')
    .insert({
      tontine_id: id,
      membre_id,
      periode,
      amount_fcfa: amount_fcfa ?? 0,
      late_fee_fcfa: late_fee_fcfa ?? 0,
      status: finalStatus,
      paid_at: finalStatus === 'paye' || finalStatus === 'partiel' ? new Date().toISOString() : null,
      notes: notes ?? null,
    })
    .select('*, tontine_membres(id, full_name, position)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // FA Flamme : +1 FA si la cotisation est payée et si le membre est un utilisateur GF
  if ((finalStatus === 'paye' || finalStatus === 'partiel') && data) {
    // Récupérer le user_id du membre
    const { data: membreRow } = await supabase
      .from('tontine_membres')
      .select('user_id')
      .eq('id', membre_id)
      .single()
    if (membreRow?.user_id) {
      await recordFlammeEvent({
        userId: membreRow.user_id,
        eventType: 'fa_tontine_cotisation',
        faDelta: 1,
        referenceId: data.id,
        referenceType: 'tontine_cotisation',
        metadata: { tontine_id: id, periode, amount_fcfa },
      }).catch(err => console.error('Flamme tontine hook error (non-blocking):', err))
    }
  }

  return NextResponse.json(data, { status: 201 })
}

interface PatchItem {
  id: string
  amount_fcfa?: number
  late_fee_fcfa?: number
  status?: string
  notes?: string
}

interface PatchBody {
  items: PatchItem[]
}

// PATCH — mise à jour groupée (ex: marquer plusieurs cotisations payées)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: tontine } = await supabase
    .from('tontines')
    .select('id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body: PatchBody = await req.json()
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Aucun élément à mettre à jour' }, { status: 400 })
  }

  const results = []
  for (const item of body.items) {
    const updates: Record<string, unknown> = {}
    if (item.amount_fcfa !== undefined)   updates.amount_fcfa = item.amount_fcfa
    if (item.late_fee_fcfa !== undefined) updates.late_fee_fcfa = item.late_fee_fcfa
    if (item.notes !== undefined)         updates.notes = item.notes
    if (item.status !== undefined) {
      updates.status = item.status
      updates.paid_at = (item.status === 'paye' || item.status === 'partiel') ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from('tontine_cotisations')
      .update(updates)
      .eq('id', item.id)
      .eq('tontine_id', id)
      .select('*, tontine_membres(id, full_name, position)')
      .single()

    if (!error && data) results.push(data)
  }

  return NextResponse.json({ updated: results })
}
