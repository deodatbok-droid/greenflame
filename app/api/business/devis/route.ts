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
    .from('biz_quotes')
    .select('id, number, status, total, valid_until, created_at, biz_customers(name)')
    .eq('business_id', member.business_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data })
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

  const body = await req.json()
  const { client, lines, notes, valid_until } = body

  if (!lines?.length) return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })

  const svc = createServiceClient()

  // Trouver ou créer le client
  let customerId: string | null = null
  if (client?.name) {
    const { data: existing } = await svc
      .from('biz_customers')
      .select('id')
      .eq('business_id', member.business_id)
      .ilike('name', client.name.trim())
      .maybeSingle()
    if (existing) {
      customerId = existing.id
    } else {
      const { data: newCust } = await svc
        .from('biz_customers')
        .insert({ business_id: member.business_id, name: client.name.trim(), email: client.email || null, phone: client.phone || null })
        .select('id').single()
      customerId = newCust?.id ?? null
    }
  }

  const items = lines.map((l: { label: string; qty: number; unit_price: number; tax_rate: number }) => ({
    label: l.label, qty: l.qty, unit_price: l.unit_price, tax_rate: l.tax_rate ?? 0,
    line_total: l.qty * l.unit_price,
  }))
  const subtotal   = items.reduce((s: number, l: { line_total: number }) => s + l.line_total, 0)
  const tax_amount = items.reduce((s: number, l: { line_total: number; tax_rate: number }) => s + l.line_total * (l.tax_rate / 100), 0)
  const total      = subtotal + tax_amount

  const number = `DEVIS-${Date.now().toString().slice(-6)}`

  const { data, error } = await svc
    .from('biz_quotes')
    .insert({
      business_id: member.business_id,
      customer_id: customerId,
      number,
      status:      'draft',
      items,
      subtotal,
      tax_amount,
      total,
      notes: notes || null,
      valid_until: valid_until || null,
      created_by: user.id,
    })
    .select('id, number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data }, { status: 201 })
}
