/**
 * /api/couture/retouches/[id] — Modification / suppression d'une retouche
 * PATCH  — met à jour description, statut, implications, coût
 * DELETE — supprime la retouche
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    description: string
    demandeur: string
    implications: string | null
    cout_supplementaire_fcfa: number
    statut: 'en_cours' | 'faite'
  }>

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.description !== undefined) updates.description = body.description.trim()
  if (body.demandeur !== undefined) updates.demandeur = body.demandeur
  if (body.implications !== undefined) updates.implications = body.implications?.trim() || null
  if (body.cout_supplementaire_fcfa !== undefined) updates.cout_supplementaire_fcfa = body.cout_supplementaire_fcfa
  if (body.statut !== undefined) updates.statut = body.statut

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('couture_retouches')
    .update(updates)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Retouche introuvable' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('couture_retouches')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
