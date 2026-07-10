/**
 * /api/couture/clients — Registre des clients couture
 * GET  — liste les clients du marchand (triés par nom)
 * POST — crée un nouveau client avec ses mesures
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getMerchantId(userId: string): Promise<string | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('couture_clients')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    full_name?: string
    phone?: string | null
    tour_poitrine?: number | null
    tour_taille?: number | null
    tour_hanches?: number | null
    longueur_dos?: number | null
    longueur_robe?: number | null
    longueur_pantalon?: number | null
    epaules?: number | null
    longueur_manche?: number | null
    tour_cou?: number | null
    notes?: string | null
  }

  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('couture_clients')
    .insert({
      merchant_id: merchantId,
      full_name: body.full_name.trim(),
      phone: body.phone ?? null,
      tour_poitrine: body.tour_poitrine ?? null,
      tour_taille: body.tour_taille ?? null,
      tour_hanches: body.tour_hanches ?? null,
      longueur_dos: body.longueur_dos ?? null,
      longueur_robe: body.longueur_robe ?? null,
      longueur_pantalon: body.longueur_pantalon ?? null,
      epaules: body.epaules ?? null,
      longueur_manche: body.longueur_manche ?? null,
      tour_cou: body.tour_cou ?? null,
      notes: body.notes ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
