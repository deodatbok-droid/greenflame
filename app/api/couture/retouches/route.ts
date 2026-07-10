/**
 * /api/couture/retouches — Création d'une retouche pour une commande
 * POST — crée une nouvelle retouche, vérifie la propriété de la commande
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    commande_id?: string
    description?: string
    demandeur?: string
    implications?: string | null
    cout_supplementaire_fcfa?: number
  }

  if (!body.commande_id) return NextResponse.json({ error: 'commande_id requis' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'Description requise' }, { status: 400 })

  const svc = createServiceClient()

  // Vérifier que la commande appartient à ce marchand
  const { data: cmd } = await svc
    .from('couture_commandes')
    .select('id')
    .eq('id', body.commande_id)
    .eq('merchant_id', merchantId)
    .single()

  if (!cmd) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data, error } = await svc
    .from('couture_retouches')
    .insert({
      commande_id: body.commande_id,
      merchant_id: merchantId,
      description: body.description.trim(),
      demandeur: body.demandeur ?? 'client',
      implications: body.implications?.trim() || null,
      cout_supplementaire_fcfa: body.cout_supplementaire_fcfa ?? 0,
      statut: 'en_cours',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
