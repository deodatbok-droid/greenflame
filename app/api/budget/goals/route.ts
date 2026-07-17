import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/budget/goals          → liste tous les objectifs actifs/pausés
 * POST /api/budget/goals          → créer un nouvel objectif
 */

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { title, icon, target_amount_fcfa, current_amount_fcfa, deadline, goal_category, target_monthly_fcfa } = body

  if (!title || !target_amount_fcfa) {
    return NextResponse.json({ error: 'title et target_amount_fcfa requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id:              user.id,
      title,
      icon:                 icon               ?? '🎯',
      target_amount_fcfa:   Number(target_amount_fcfa),
      current_amount_fcfa:  Number(current_amount_fcfa ?? 0),
      deadline:             deadline            ?? null,
      goal_category:        goal_category       ?? null,
      target_monthly_fcfa:  target_monthly_fcfa ? Number(target_monthly_fcfa) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
