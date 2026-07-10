import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PlatsPayload = {
  nom_plat: string
  description?: string
  categorie: string
  prix_vente_fcfa: number
  recette_id?: string | null
  disponible?: boolean
  position?: number
}[]

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 403 })

  const { plats, ...menuFields } = await req.json() as { plats?: PlatsPayload } & Record<string, unknown>

  const now = new Date().toISOString()

  if (Object.keys(menuFields).length > 0) {
    const { error } = await supabase
      .from('resto_menus')
      .update({ ...menuFields, updated_at: now })
      .eq('id', id)
      .eq('merchant_id', merchant.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (plats !== undefined) {
    await supabase.from('resto_menu_plats').delete().eq('menu_id', id)
    if (plats.length > 0) {
      const rows = plats.map((p, i) => ({
        menu_id: id,
        nom_plat: p.nom_plat,
        description: p.description ?? null,
        categorie: p.categorie ?? 'plat',
        prix_vente_fcfa: p.prix_vente_fcfa ?? 0,
        recette_id: p.recette_id ?? null,
        disponible: p.disponible ?? true,
        position: p.position ?? i,
      }))
      const { error } = await supabase.from('resto_menu_plats').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('resto_menus')
    .select('*, resto_menu_plats(*)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 403 })

  const { error } = await supabase
    .from('resto_menus')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchant.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
