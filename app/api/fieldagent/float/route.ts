import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const [accountRes, ledgerRes] = await Promise.all([
    svc.from('agent_float_accounts').select('*').eq('agent_id', user.id).maybeSingle(),
    svc.from('agent_float_ledger')
      .select(`
        id, entry_type, amount_fcfa, balance_after, notes, created_at,
        consumer:users!agent_float_ledger_consumer_id_fkey(full_name, phone)
      `)
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  return NextResponse.json({
    account: accountRes.data ?? null,
    ledger:  ledgerRes.data ?? [],
  })
}
