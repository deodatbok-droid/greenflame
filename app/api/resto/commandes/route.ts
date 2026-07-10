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
    .from('resto_commandes')
    .select('*, resto_commande_plats(*)')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(100)
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
    client_id?: string | null
    nom_client?: string
    table_num?: string
    nb_couverts?: number
    notes?: string
    plats: { nom_plat: string; prix_unitaire_fcfa: number; quantite: number; notes?: string }[]
  }

  const total = (body.plats ?? []).reduce(
    (s, p) => s + p.prix_unitaire_fcfa * (p.quantite ?? 1), 0
  )

  const { data: commande, error: cmdErr } = await supabase
    .from('resto_commandes')
    .insert({
      merchant_id: merchant.id,
      client_id: body.client_id ?? null,
      nom_client: body.nom_client ?? null,
      table_num: body.table_num ?? null,
      nb_couverts: body.nb_couverts ?? 1,
      notes: body.notes ?? null,
      total_fcfa: total,
    })
    .select()
    .single()
  if (cmdErr) return NextResponse.json({ error: cmdErr.message }, { status: 500 })

  if (body.plats?.length > 0) {
    const rows = body.plats.map((p) => ({
      commande_id: commande.id,
      nom_plat: p.nom_plat,
      prix_unitaire_fcfa: p.prix_unitaire_fcfa,
      quantite: p.quantite ?? 1,
      notes: p.notes ?? null,
    }))
    const { error: platsErr } = await supabase.from('resto_commande_plats').insert(rows)
    if (platsErr) return NextResponse.json({ error: platsErr.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('resto_commandes')
    .select('*, resto_commande_plats(*)')
    .eq('id', commande.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
