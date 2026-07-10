import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 403 })

  const { data, error } = await supabase
    .from('resto_menus')
    .select('*, resto_menu_plats(*)')
    .eq('merchant_id', merchant.id)
    .order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 403 })

  const body = await req.json() as { date: string; titre?: string; notes?: string }

  const { data, error } = await supabase
    .from('resto_menus')
    .insert({
      merchant_id: merchant.id,
      date: body.date,
      titre: body.titre ?? null,
      notes: body.notes ?? null,
    })
    .select('*, resto_menu_plats(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
