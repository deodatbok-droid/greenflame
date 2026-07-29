import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: member } = await auth
    .from('biz_members')
    .select('business_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_suppliers')
    .select('id, name, contact_name, email, phone, country, created_at')
    .eq('business_id', member.business_id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suppliers: data })
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: member } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (member.role === 'staff') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })

  const { name, contact_name, email, phone, country, address, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_suppliers')
    .insert({
      business_id:  member.business_id,
      name:         name.trim(),
      contact_name: contact_name || null,
      email:        email || null,
      phone:        phone || null,
      country:      country || null,
      address:      address || null,
      notes:        notes || null,
    })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supplier: data }, { status: 201 })
}
