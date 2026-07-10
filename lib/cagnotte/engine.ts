import { createServiceClient } from '@/lib/supabase/server'
import { announceInOwnCircle } from '@/lib/messaging/conversations'

const POT_ID = '00000000-0000-0000-0000-000000000001'
const MONTHLY_RETENTION_FCFA = 50

export interface PotState {
  current_balance_fcfa: number
  total_contributed_fcfa: number
  total_drawn_fcfa: number
  active_contributors: number
  last_draw_at: string | null
}

export interface UserEligibility {
  contributedThisMonth: boolean
  blockedUntil: string | null
  isEligible: boolean
}

export async function getPotState(): Promise<PotState> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('community_pot')
    .select('current_balance_fcfa, total_contributed_fcfa, total_drawn_fcfa, active_contributors, last_draw_at')
    .eq('id', POT_ID)
    .single()
  return (data ?? {
    current_balance_fcfa: 0, total_contributed_fcfa: 0, total_drawn_fcfa: 0,
    active_contributors: 0, last_draw_at: null,
  }) as PotState
}

export async function retainMonthlyContribution(
  userId: string,
  period: string,
  cashbackDistId?: string,
): Promise<boolean> {
  const svc = createServiceClient()

  const { error } = await svc.from('pot_contributions').insert({
    user_id: userId,
    period,
    amount_fcfa: MONTHLY_RETENTION_FCFA,
    cashback_dist_id: cashbackDistId ?? null,
  })

  if (error) return false

  const { data: pot } = await svc
    .from('community_pot')
    .select('current_balance_fcfa, total_contributed_fcfa')
    .eq('id', POT_ID)
    .single()

  if (pot) {
    const p = pot as { current_balance_fcfa: number; total_contributed_fcfa: number }
    await svc.from('community_pot').update({
      current_balance_fcfa: p.current_balance_fcfa + MONTHLY_RETENTION_FCFA,
      total_contributed_fcfa: p.total_contributed_fcfa + MONTHLY_RETENTION_FCFA,
      updated_at: new Date().toISOString(),
    }).eq('id', POT_ID)
  }

  return true
}

export async function triggerDraw(
  triggeredBy: string,
  amountFcfa?: number,
): Promise<{ winnerId: string; amount: number } | null> {
  const svc = createServiceClient()

  const { data: pot } = await svc
    .from('community_pot')
    .select('current_balance_fcfa, total_drawn_fcfa')
    .eq('id', POT_ID)
    .single()

  if (!pot) return null

  const p = pot as { current_balance_fcfa: number; total_drawn_fcfa: number }
  const drawAmount = amountFcfa ?? p.current_balance_fcfa
  if (drawAmount <= 0) return null

  const { data: eligible } = await svc.from('pot_eligible_members').select('user_id')
  if (!eligible || eligible.length === 0) return null

  const winner = (eligible as Array<{ user_id: string }>)[
    Math.floor(Math.random() * eligible.length)
  ]

  const now = new Date().toISOString()

  const { data: draw } = await svc.from('pot_draws').insert({
    triggered_by: triggeredBy,
    amount_drawn_fcfa: drawAmount,
    pot_balance_before: p.current_balance_fcfa,
    eligible_count: eligible.length,
    status: 'drawn',
    drawn_at: now,
  }).select().single()

  if (!draw) return null
  const drawId = (draw as { id: string }).id

  await svc.from('pot_winners').insert({
    draw_id: drawId,
    user_id: winner.user_id,
    amount_won_fcfa: drawAmount,
    eligible_again_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  const CONSOLATION_ITEMS = [
    'academie_module_unlock',
    'pack_mystere_bronze',
    'boost_cashback_7d',
    'fa_bonus_5',
    'gfp_bonus_100',
  ] as const

  const losers = (eligible as Array<{ user_id: string }>).filter(e => e.user_id !== winner.user_id)
  for (const loser of losers) {
    const item = CONSOLATION_ITEMS[Math.floor(Math.random() * CONSOLATION_ITEMS.length)]
    await svc.from('pot_consolations').insert({
      draw_id: drawId,
      user_id: loser.user_id,
      item_key: item,
    })
  }

  await svc.from('community_pot').update({
    current_balance_fcfa: Math.max(0, p.current_balance_fcfa - drawAmount),
    total_drawn_fcfa: p.total_drawn_fcfa + drawAmount,
    last_draw_at: now,
    last_draw_id: drawId,
    updated_at: now,
  }).eq('id', POT_ID)

  // Preuve sociale : annonce un fait déjà survenu (tirage déjà effectué
  // ci-dessus), dans le cercle propre du gagnant — la cagnotte est un pot
  // global, pas scopé par cercle, donc on ne diffuse jamais plateforme-large.
  // Non bloquant : voir announceInOwnCircle.
  const { data: winnerProfile } = await svc.from('users').select('full_name').eq('id', winner.user_id).maybeSingle()
  const winnerName = (winnerProfile?.full_name as string | undefined) ?? 'Un membre du cercle'
  await announceInOwnCircle(
    svc,
    winner.user_id,
    `🎉 *${winnerName}* a remporté ${drawAmount.toLocaleString('fr-FR')} FCFA au tirage de la Cagnotte Communautaire !`,
  )

  return { winnerId: winner.user_id, amount: drawAmount }
}

export async function getUserConsolations(userId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('pot_consolations')
    .select('id, item_key, delivered, created_at')
    .eq('user_id', userId)
    .eq('delivered', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function deliverConsolation(consolationId: string): Promise<void> {
  const svc = createServiceClient()
  await svc.from('pot_consolations').update({
    delivered: true,
    delivered_at: new Date().toISOString(),
  }).eq('id', consolationId)
}

export async function getUserEligibility(userId: string): Promise<UserEligibility> {
  const svc = createServiceClient()
  const period = new Date().toISOString().slice(0, 7)

  const { data: contribution } = await svc
    .from('pot_contributions')
    .select('id')
    .eq('user_id', userId)
    .eq('period', period)
    .single()

  const { data: winner } = await svc
    .from('pot_winners')
    .select('eligible_again_at')
    .eq('user_id', userId)
    .gt('eligible_again_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const blockedUntil = winner ? (winner as { eligible_again_at: string }).eligible_again_at : null

  return {
    contributedThisMonth: !!contribution,
    blockedUntil,
    isEligible: !!contribution && !blockedUntil,
  }
}
