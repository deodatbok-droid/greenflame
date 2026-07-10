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
    .from('resto_clients')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('nom')
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

  const body = await req.json() as {
    nom: string; telephone?: string; email?: string; notes?: string; preferences?: string
  }

  const { data, error } = await supabase
    .from('resto_clients')
    .insert({
      merchant_id: merchant.id,
      nom: body.nom,
      telephone: body.telephone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
      preferences: body.preferences ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
