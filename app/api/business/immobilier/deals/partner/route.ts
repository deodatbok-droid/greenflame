import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function resolveBusinessId(requestedId?: string | null): Promise<string | null> {
  if (requestedId) return requestedId
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data } = await auth.from('biz_members').select('business_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.business_id ?? null
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const slug = url.searchParams.get('slug')?.trim().toLowerCase()
  if (!slug) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 })

  const svc = createServiceClient()
  const { data } = await svc.from('biz_accounts').select('id, name, slug').eq('slug', slug).maybeSingle()

  if (!data) return NextResponse.json({ error: 'Aucun partenaire trouvé avec cet identifiant' }, { status: 404 })
  if (data.id === businessId) return NextResponse.json({ error: 'Vous ne pouvez pas vous ajouter vous-même' }, { status: 400 })

  return NextResponse.json({ id: data.id, name: data.name, slug: data.slug })
}
