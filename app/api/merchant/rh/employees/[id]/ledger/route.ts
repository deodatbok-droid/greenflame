import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getMerchantId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: merchant } = await svc.from('merchants').select('id').eq('user_id', user.id).single()
  return merchant?.id ?? null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const merchantId = await getMerchantId()
  if (!merchantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  // Vérifier que cet employé appartient au marchand
  const { data: emp } = await svc
    .from('merchant_employees')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()
  if (!emp) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data, error } = await svc
    .from('employee_ledger')
    .select('*')
    .eq('employee_id', id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const merchantId = await getMerchantId()
  if (!merchantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { type, date, amount, units, note,
          include_cnss, cnss_part_employee, cnss_part_employer } = body

  if (!type) return NextResponse.json({ error: 'Type requis' }, { status: 400 })

  const svc = createServiceClient()

  // Vérifier appartenance
  const { data: emp } = await svc
    .from('merchant_employees')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()
  if (!emp) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data, error } = await svc
    .from('employee_ledger')
    .insert({
      employee_id:  id,
      merchant_id:  merchantId,
      type,
      date:         date ?? new Date().toISOString().slice(0, 10),
      amount:       amount !== undefined && amount !== '' ? Number(amount) : null,
      units:        units  !== undefined && units  !== '' ? Number(units)  : null,
      note:         note?.trim() || null,
      include_cnss: include_cnss ?? false,
      cnss_part_employee: include_cnss ? Number(cnss_part_employee ?? 3.6) : null,
      cnss_part_employer: include_cnss ? Number(cnss_part_employer ?? 16.4) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
