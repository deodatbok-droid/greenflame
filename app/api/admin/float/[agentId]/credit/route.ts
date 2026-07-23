import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { amount_fcfa, float_limit_fcfa, notes } = await req.json() as {
    amount_fcfa?: number; float_limit_fcfa?: number; notes?: string
  }

  if (!amount_fcfa || amount_fcfa <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  // Vérifier que l'agent existe et a bien le rôle field_agent
  const { data: agent } = await svc.from('users').select('id, full_name, role').eq('id', agentId).maybeSingle()
  if (!agent) return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 })
  const hasRole = (agent.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!hasRole) return NextResponse.json({ error: 'Cet utilisateur n\'est pas un agent terrain' }, { status: 400 })

  // Upsert float account
  const { data: existing } = await svc
    .from('agent_float_accounts')
    .select('id, balance_fcfa')
    .eq('agent_id', agentId)
    .maybeSingle()

  let newBalance: number
  let accountId: string

  if (existing) {
    newBalance = existing.balance_fcfa + amount_fcfa
    const updateData: Record<string, unknown> = { balance_fcfa: newBalance }
    if (float_limit_fcfa) updateData.float_limit_fcfa = float_limit_fcfa
    await svc.from('agent_float_accounts').update(updateData).eq('id', existing.id)
    accountId = existing.id
  } else {
    newBalance = amount_fcfa
    const { data: created } = await svc.from('agent_float_accounts').insert({
      agent_id:         agentId,
      balance_fcfa:     newBalance,
      float_limit_fcfa: float_limit_fcfa ?? 200000,
    }).select('id').single()
    accountId = created?.id ?? ''
  }

  // Enregistrer dans le ledger
  await svc.from('agent_float_ledger').insert({
    agent_id:      agentId,
    entry_type:    'admin_credit',
    amount_fcfa:   amount_fcfa,
    balance_after: newBalance,
    notes:         notes?.trim() || null,
    created_by:    user.id,
  })

  void insertNotification({
    userId:  agentId,
    type:    'float_credited',
    title:   'Float alimenté',
    body:    `${amount_fcfa.toLocaleString('fr-FR')} FCFA ont été crédités sur votre float GreenFlame. Solde : ${newBalance.toLocaleString('fr-FR')} FCFA.`,
  })

  return NextResponse.json({ ok: true, accountId, newBalance })
}
