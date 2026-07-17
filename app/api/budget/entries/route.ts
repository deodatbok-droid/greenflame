import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/budget/entries?month=YYYY-MM&type=income|expense
 * POST /api/budget/entries  { type, amount_fcfa, category, label?, note?, entry_date? }
 */

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const type  = searchParams.get('type')  // 'income' | 'expense' | null

  let query = supabase
    .from('budget_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_key', month)
    .order('entry_date', { ascending: false })

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { type, amount_fcfa, category, label, note, entry_date } = body

  if (!type || !amount_fcfa || !category) {
    return NextResponse.json({ error: 'type, amount_fcfa et category sont requis' }, { status: 400 })
  }
  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type doit être income ou expense' }, { status: 400 })
  }
  if (Number(amount_fcfa) <= 0) {
    return NextResponse.json({ error: 'amount_fcfa doit être positif' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('budget_entries')
    .insert({
      user_id:    user.id,
      type,
      amount_fcfa: Number(amount_fcfa),
      category,
      label:       label ?? null,
      note:        note  ?? null,
      entry_date:  entry_date ?? new Date().toISOString().slice(0, 10),
      source:      'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
