import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/budget/entries/[id]
 * PUT    /api/budget/entries/[id]  { amount_fcfa?, category?, label?, note?, entry_date? }
 */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('budget_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { amount_fcfa, category, label, note, entry_date } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (amount_fcfa !== undefined) updates.amount_fcfa = Number(amount_fcfa)
  if (category    !== undefined) updates.category    = category
  if (label       !== undefined) updates.label       = label
  if (note        !== undefined) updates.note        = note
  if (entry_date  !== undefined) updates.entry_date  = entry_date

  const { data, error } = await supabase
    .from('budget_entries')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
