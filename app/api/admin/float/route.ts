import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Tous les agents avec leurs comptes float (et ceux sans compte)
  const [agentsRes, accountsRes] = await Promise.all([
    svc.from('users').select('id, full_name, phone').contains('role', ['field_agent']),
    svc.from('agent_float_accounts').select('*'),
  ])

  const agents   = agentsRes.data ?? []
  const accounts = accountsRes.data ?? []
  const accountMap = Object.fromEntries(accounts.map(a => [a.agent_id, a]))

  const result = agents.map(agent => ({
    agent,
    account: accountMap[agent.id] ?? null,
  }))

  return NextResponse.json(result)
}
