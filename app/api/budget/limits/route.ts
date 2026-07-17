import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/budget/limits
 *   Retourne tous les plafonds de l'utilisateur (toutes catégories)
 *
 * PUT /api/budget/limits
 *   Body: { category: string, monthly_limit_fcfa: number }
 *   Upsert (insère ou met à jour) le plafond pour une catégorie
 *
 * DELETE /api/budget/limits?category=...
 *   Supprime le plafond pour une catégorie
 */

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('budget_limits')
    .select('*')
    .eq('user_id', user.id)
    .order('category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { category, monthly_limit_fcfa } = await req.json()
  if (!category || !monthly_limit_fcfa) {
    return NextResponse.json({ error: 'category et monthly_limit_fcfa requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('budget_limits')
    .upsert({
      user_id: user.id,
      category,
      monthly_limit_fcfa: Number(monthly_limit_fcfa),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,category' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const category = new URL(req.url).searchParams.get('category')
  if (!category) return NextResponse.json({ error: 'category requis' }, { status: 400 })

  const { error } = await supabase
    .from('budget_limits')
    .delete()
    .eq('user_id', user.id)
    .eq('category', category)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
