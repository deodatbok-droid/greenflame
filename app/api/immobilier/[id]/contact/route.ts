import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const service = createServiceClient()

  const { data: hasPass } = await service.rpc('buyer_pass_active', { p_user_id: user.id })
  if (!hasPass) {
    return NextResponse.json({ error: 'Pass chercheur requis pour voir le contact', passRequired: true }, { status: 402 })
  }

  const { data: property } = await service
    .from('biz_properties')
    .select('business_id, gf_listed, status')
    .eq('id', id)
    .maybeSingle()

  if (!property || !property.gf_listed || property.status !== 'disponible') {
    return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })
  }

  const { data: account } = await service
    .from('biz_accounts')
    .select('owner_id, name')
    .eq('id', property.business_id)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const { data: owner } = await service
    .from('users')
    .select('phone')
    .eq('id', account.owner_id)
    .maybeSingle()

  return NextResponse.json({ name: account.name, phone: owner?.phone ?? null })
}
