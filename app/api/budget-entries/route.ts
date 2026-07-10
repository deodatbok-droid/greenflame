import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { refreshUserScore } from '@/lib/scoring/engine'

const VALID_TYPES = ['rentree', 'depense_fixe', 'depense_variable', 'epargne'] as const
const VALID_CATS = [
  'alimentation', 'transport', 'loyer', 'sante', 'scolarite',
  'tontine', 'communication', 'loisirs', 'imprevus', 'dettes', 'epargne', 'autre',
] as const

// GET /api/budget-entries?limit=10&date=2026-06-11
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10'), 50)
  const date = req.nextUrl.searchParams.get('date')

  const svc = createServiceClient()
  let query = svc
    .from('budget_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date_entree', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (date) query = query.eq('date_entree', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/budget-entries
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json() as {
    montant_fcfa?: number
    type?: string
    categorie?: string
    description?: string
    source?: string
    date_entree?: string
  }

  const { montant_fcfa, type = 'depense_variable', categorie = 'autre', description, source = 'manual', date_entree } = body

  if (!montant_fcfa || montant_fcfa <= 0 || !Number.isInteger(montant_fcfa)) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  if (!VALID_CATS.includes(categorie as typeof VALID_CATS[number])) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('budget_entries')
    .insert({
      user_id: user.id,
      montant_fcfa,
      type,
      categorie,
      description: description?.trim() || null,
      source: ['manual', 'voice', 'momo_auto'].includes(source) ? source : 'manual',
      date_entree: date_entree ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  refreshUserScore(user.id).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
