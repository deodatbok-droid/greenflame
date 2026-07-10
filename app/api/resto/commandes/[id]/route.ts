import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('user_id', user.id).single()
  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 403 })

  const body = await req.json() as { statut?: string; notes?: string; nom_client?: string; table_num?: string }

  const { data, error } = await supabase
    .from('resto_commandes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .select('*, resto_commande_plats(*)')
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
    .from('resto_commandes')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchant.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
