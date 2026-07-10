/**
 * Moteur de scoring GreenFlame
 * Score sur 1000 pts — déclenché à l'inscription et à chaque action significative
 */
import { createServiceClient } from '@/lib/supabase/server'

export type ScoreDetails = {
  profil: number       // max 50
  activite: number     // max 250
  reseau: number       // max 150
  tontine: number      // max 150
  academie: number     // max 200
  epargne: number      // max 200
  total: number        // max 1000
}

export type ScoreNiveau = 'debutant' | 'actif' | 'fiable' | 'avance' | 'expert'

export type BnplTier = {
  eligible: boolean
  plafond_fcfa: number
}

export type UserScoreResult = {
  details: ScoreDetails
  niveau: ScoreNiveau
  bnpl: BnplTier
}

export function getNiveau(score: number): ScoreNiveau {
  if (score < 150) return 'debutant'
  if (score < 300) return 'actif'
  if (score < 500) return 'fiable'
  if (score < 700) return 'avance'
  return 'expert'
}

export function getBnplTier(score: number): BnplTier {
  if (score < 300) return { eligible: false, plafond_fcfa: 0 }
  if (score < 500) return { eligible: true, plafond_fcfa: 10_000 }
  if (score < 700) return { eligible: true, plafond_fcfa: 50_000 }
  return { eligible: true, plafond_fcfa: 150_000 }
}

export async function computeUserScore(userId: string): Promise<ScoreDetails> {
  const svc = createServiceClient()

  const details: ScoreDetails = {
    profil: 0, activite: 0, reseau: 0,
    tontine: 0, academie: 0, epargne: 0, total: 0,
  }

  // ── PROFIL (max 50) ──────────────────────────────────────────────────────
  const { data: user } = await svc
    .from('users')
    .select('full_name, avatar_url, onboarding_done, kyc_level')
    .eq('id', userId)
    .single()

  if (user?.full_name?.trim()) details.profil += 5
  if (user?.avatar_url) details.profil += 10
  if (user?.onboarding_done) details.profil += 15
  if ((user?.kyc_level ?? 0) >= 1) details.profil += 20
  details.profil = Math.min(details.profil, 50)

  // ── ACTIVITÉ TRANSACTIONNELLE (max 250) ──────────────────────────────────
  const { count: txTotal } = await svc
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},merchant_id.eq.${userId}`)
    .eq('status', 'completed')

  if ((txTotal ?? 0) >= 1) details.activite += 50
  if ((txTotal ?? 0) >= 3) details.activite += 30
  if ((txTotal ?? 0) >= 10) details.activite += 30

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const { count: txRecent } = await svc
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},merchant_id.eq.${userId}`)
    .eq('status', 'completed')
    .gte('created_at', since30.toISOString())

  if ((txRecent ?? 0) > 0) details.activite += 40

  const { data: merchant } = await svc
    .from('merchants')
    .select('id, is_active')
    .eq('user_id', userId)
    .single()

  if (merchant?.is_active) details.activite += 50

  if ((user?.kyc_level ?? 0) >= 1) details.activite += 30
  if ((user?.kyc_level ?? 0) >= 2) details.activite += 20

  details.activite = Math.min(details.activite, 250)

  // ── RÉSEAU (max 150) ─────────────────────────────────────────────────────
  const { data: networkTree } = await svc
    .from('network_tree')
    .select('l1_upline')
    .eq('user_id', userId)
    .single()

  if (networkTree?.l1_upline) details.reseau += 20

  const { count: l1Count } = await svc
    .from('network_tree')
    .select('user_id', { count: 'exact', head: true })
    .eq('l1_upline', userId)

  if ((l1Count ?? 0) >= 1) details.reseau += 30
  if ((l1Count ?? 0) >= 3) details.reseau += 30
  if ((l1Count ?? 0) >= 5) details.reseau += 30

  const { count: networkTotal } = await svc
    .from('network_tree')
    .select('user_id', { count: 'exact', head: true })
    .or(`l1_upline.eq.${userId},l2_upline.eq.${userId},l3_upline.eq.${userId},l4_upline.eq.${userId},l5_upline.eq.${userId}`)

  if ((networkTotal ?? 0) >= 10) details.reseau += 40

  details.reseau = Math.min(details.reseau, 150)

  // ── TONTINE (max 150) ────────────────────────────────────────────────────
  const { data: membres } = await svc
    .from('tontine_membres')
    .select('id')
    .eq('user_id', userId)

  if ((membres?.length ?? 0) > 0) {
    details.tontine += 30
    const membreIds = membres!.map((m) => m.id)

    const { count: cotPaid } = await svc
      .from('tontine_cotisations')
      .select('id', { count: 'exact', head: true })
      .in('membre_id', membreIds)
      .not('paid_at', 'is', null)

    if ((cotPaid ?? 0) >= 1) details.tontine += 20
    if ((cotPaid ?? 0) >= 3) details.tontine += 30
    if ((cotPaid ?? 0) >= 10) details.tontine += 30

    const since40 = new Date()
    since40.setDate(since40.getDate() - 40)
    const { count: cotRecent } = await svc
      .from('tontine_cotisations')
      .select('id', { count: 'exact', head: true })
      .in('membre_id', membreIds)
      .not('paid_at', 'is', null)
      .gte('paid_at', since40.toISOString())

    if ((cotRecent ?? 0) > 0) details.tontine += 40
  }

  details.tontine = Math.min(details.tontine, 150)

  // ── ACADÉMIE / BUDGET (max 200) ──────────────────────────────────────────
  const { data: progress } = await svc
    .from('budget_formation_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (progress) {
    if (progress.f1_simulator) details.academie += 20
    if (progress.f2_simulator) details.academie += 20
    if (progress.f3_simulator) details.academie += 20
    if ((progress.f1_quiz_score ?? 0) >= 3) details.academie += 20
    if ((progress.f2_quiz_score ?? 0) >= 3) details.academie += 20
    if ((progress.f3_quiz_score ?? 0) >= 3) details.academie += 20
  }

  const { data: budgetProfile } = await svc
    .from('budget_profiles')
    .select('revenus_mensuels_fcfa, enveloppe_epargne_pct, objectif_epargne_fcfa, coussin_actuel_fcfa')
    .eq('user_id', userId)
    .single()

  if ((budgetProfile?.revenus_mensuels_fcfa ?? 0) > 0) details.academie += 20
  if ((budgetProfile?.objectif_epargne_fcfa ?? 0) > 0) details.academie += 20

  const since7 = new Date()
  since7.setDate(since7.getDate() - 7)
  const { count: recentEntries } = await svc
    .from('budget_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since7.toISOString())

  if ((recentEntries ?? 0) > 0) details.academie += 20

  const { count: activeReminders } = await svc
    .from('budget_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('actif', true)

  if ((activeReminders ?? 0) > 0) details.academie += 20

  details.academie = Math.min(details.academie, 200)

  // ── ÉPARGNE (max 200) ────────────────────────────────────────────────────
  const { data: wallet } = await svc
    .from('wallets')
    .select('balance_fcfa, total_earned_fcfa')
    .eq('user_id', userId)
    .single()

  if ((wallet?.balance_fcfa ?? 0) > 0) details.epargne += 20
  if ((wallet?.balance_fcfa ?? 0) >= 5_000) details.epargne += 20
  if ((wallet?.total_earned_fcfa ?? 0) > 0) details.epargne += 20
  if ((wallet?.total_earned_fcfa ?? 0) >= 10_000) details.epargne += 20

  if (budgetProfile) {
    if ((budgetProfile.enveloppe_epargne_pct ?? 0) >= 10) details.epargne += 40
    if (
      (budgetProfile.coussin_actuel_fcfa ?? 0) > 0 &&
      (budgetProfile.revenus_mensuels_fcfa ?? 0) > 0
    ) {
      const besoins = budgetProfile.revenus_mensuels_fcfa * ((budgetProfile as any).enveloppe_besoins_pct ?? 65) / 100
      if (budgetProfile.coussin_actuel_fcfa >= besoins) details.epargne += 50
    }
  }

  const since30b = new Date()
  since30b.setDate(since30b.getDate() - 30)
  const { count: savingsEntries } = await svc
    .from('budget_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'epargne')
    .gte('date_entree', since30b.toISOString().split('T')[0])

  if ((savingsEntries ?? 0) > 0) details.epargne += 30

  details.epargne = Math.min(details.epargne, 200)

  // ── TOTAL ────────────────────────────────────────────────────────────────
  details.total = Math.min(
    details.profil + details.activite + details.reseau +
    details.tontine + details.academie + details.epargne,
    1000,
  )

  return details
}

export async function refreshUserScore(userId: string): Promise<UserScoreResult> {
  const svc = createServiceClient()
  const details = await computeUserScore(userId)
  const niveau = getNiveau(details.total)
  const bnpl = getBnplTier(details.total)

  await svc.from('user_scores').upsert({
    user_id: userId,
    score: details.total,
    score_details: details,
    niveau,
    bnpl_eligible: bnpl.eligible,
    bnpl_plafond_fcfa: bnpl.plafond_fcfa,
    last_computed_at: new Date().toISOString(),
  })

  return { details, niveau, bnpl }
}
