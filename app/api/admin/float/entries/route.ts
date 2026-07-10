import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return null
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const svc = createServiceClient()

  const { data: entries, error } = await svc
    .from('float_entries')
    .select('id, entry_type, amount_fcfa, operator_ref, merchant_id, notes, entry_date, recorded_by, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Résoudre les noms de marchands et opérateurs
  const merchantIds = [...new Set((entries ?? []).map(e => e.merchant_id).filter(Boolean) as string[])]
  const recorderIds = [...new Set((entries ?? []).map(e => e.recorded_by).filter(Boolean) as string[])]

  const [merchantsRes, recordersRes] = await Promise.all([
    merchantIds.length > 0
      ? svc.from('merchants').select('id, business_name').in('id', merchantIds)
      : { data: [] },
    recorderIds.length > 0
      ? svc.from('users').select('id, full_name').in('id', recorderIds)
      : { data: [] },
  ])

  const merchantMap = Object.fromEntries((merchantsRes.data ?? []).map(m => [m.id, m.business_name]))
  const recorderMap = Object.fromEntries((recordersRes.data ?? []).map(u => [u.id, u.full_name]))

  const enriched = (entries ?? []).map(e => ({
    ...e,
    merchant_name: e.merchant_id ? (merchantMap[e.merchant_id] ?? null) : null,
    recorder_name: recorderMap[e.recorded_by] ?? null,
  }))

  return NextResponse.json({ entries: enriched })
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const svc = createServiceClient()

  let body: {
    entry_type: string
    amount_fcfa: number
    operator_ref?: string
    merchant_id?: string
    notes?: string
    entry_date?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { entry_type, amount_fcfa, operator_ref, merchant_id, notes, entry_date } = body

  const validTypes = ['cash_collected', 'mtn_momo', 'moov_money', 'celtiis', 'adjustment_plus', 'adjustment_minus']
  if (!entry_type || !validTypes.includes(entry_type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  if (!amount_fcfa || amount_fcfa <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  const { data: entry, error } = await svc
    .from('float_entries')
    .insert({
      entry_type,
      amount_fcfa,
      operator_ref: operator_ref || null,
      merchant_id:  merchant_id  || null,
      notes:        notes        || null,
      entry_date:   entry_date   || new Date().toISOString().slice(0, 10),
      recorded_by:  user.id,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: entry.id })
}
