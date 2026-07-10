/**
 * /api/btp/materiaux/[id] — Matériau BTP individuel
 * PATCH  — modifie un matériau
 * DELETE — supprime un matériau
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { id } = await params
  const body = await req.json() as {
    name?: string
    unit?: string
    price_per_unit_fcfa?: number
    category?: string
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('btp_materiaux')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { id } = await params

  const svc = createServiceClient()
  const { error } = await svc
    .from('btp_materiaux')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
