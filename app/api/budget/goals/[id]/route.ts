import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT    /api/budget/goals/[id]  → mettre à jour (titre, montant courant, deadline, statut…)
 * DELETE /api/budget/goals/[id]  → supprimer l'objectif
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body   = await req.json()

  const allowed = ['title','icon','target_amount_fcfa','current_amount_fcfa','deadline','goal_category','target_monthly_fcfa','status']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = ['target_amount_fcfa','current_amount_fcfa','target_monthly_fcfa'].includes(key)
        ? Number(body[key])
        : body[key]
    }
  }

  const { data, error } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
