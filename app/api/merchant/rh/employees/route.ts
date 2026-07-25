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

export async function GET() {
  const merchantId = await getMerchantId()
  if (!merchantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  // Employés avec leur solde calculé depuis le ledger
  const { data: employees, error } = await svc
    .from('merchant_employees')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('status', { ascending: false })
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ledger résumé par employé (pour soldes)
  const { data: ledger } = await svc
    .from('employee_ledger')
    .select('employee_id, type, amount, units')
    .eq('merchant_id', merchantId)

  type LedgerRow = { employee_id: string; type: string; amount: number | null; units: number | null }
  const ledgerRows: LedgerRow[] = (ledger ?? []) as LedgerRow[]

  const enriched = (employees ?? []).map(emp => {
    const rows = ledgerRows.filter(r => r.employee_id === emp.id)
    const gagné  = rows.filter(r => r.type === 'work' || r.type === 'bonus')
                       .reduce((s, r) => s + (r.amount ?? 0), 0)
    const avances = rows.filter(r => r.type === 'advance')
                        .reduce((s, r) => s + (r.amount ?? 0), 0)
    const payé    = rows.filter(r => r.type === 'payment')
                        .reduce((s, r) => s + (r.amount ?? 0), 0)
    const retenues = rows.filter(r => r.type === 'deduction')
                         .reduce((s, r) => s + (r.amount ?? 0), 0)
    const solde   = gagné + avances - payé - retenues
    return { ...emp, solde, gagné, avances, payé }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const merchantId = await getMerchantId()
  if (!merchantId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { full_name, role, phone, pay_type, base_amount, notes,
          is_formal, cnss_number, contract_type, contract_start, contract_end } = body

  if (!full_name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('merchant_employees')
    .insert({
      merchant_id: merchantId,
      full_name:   full_name.trim(),
      role:        role?.trim() || null,
      phone:       phone?.trim() || null,
      pay_type:    pay_type ?? 'daily',
      base_amount: base_amount ? Number(base_amount) : null,
      notes:       notes?.trim() || null,
      is_formal:   is_formal ?? false,
      cnss_number: cnss_number?.trim() || null,
      contract_type:  contract_type || null,
      contract_start: contract_start || null,
      contract_end:   contract_end || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
