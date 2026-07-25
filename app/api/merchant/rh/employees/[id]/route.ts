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
  const { data, error } = await svc
    .from('merchant_employees')
    .select('*')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const merchantId = await getMerchantId()
  if (!merchantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const allowed = ['full_name', 'role', 'phone', 'pay_type', 'base_amount', 'notes',
                   'status', 'is_formal', 'cnss_number', 'contract_type',
                   'contract_start', 'contract_end']
  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) update[k] = body[k] === '' ? null : body[k]
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('merchant_employees')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
