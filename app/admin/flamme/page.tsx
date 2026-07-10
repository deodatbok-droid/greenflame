/**
 * /admin/flamme — Tableau de bord admin Flamme + Rang + Cagnotte
 * Vue d'ensemble des rangs, gestion des tirages, historique.
 */
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminFlammeClient from './AdminFlammeClient'

export default async function AdminFlammePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role?.includes('admin') && !profile?.role?.includes('platform_upline')) {
    redirect('/dashboard')
  }

  const svc = createServiceClient()

  // Statistiques des rangs
  const [statsRes, drawsRes, topRes, potRes] = await Promise.all([
    svc.from('flamme_community_stats').select('*').single(),
    svc.from('pot_draws')
      .select('*, pot_winners(user_id, amount_won_fcfa, eligible_again_at, users(full_name, phone))')
      .order('created_at', { ascending: false })
      .limit(10),
    svc.from('flamme_rang_summary')
      .select('user_id, full_name, phone, score_flamme, rang, life_goals_covered, flammes_activite, flammes_autonomie, updated_at')
      .order('score_flamme', { ascending: false })
      .limit(20),
    svc.from('community_pot').select('*').single(),
  ])

  return (
    <AdminFlammeClient
      communityStats={statsRes.data}
      recentDraws={drawsRes.data ?? []}
      topMembers={topRes.data ?? []}
      pot={potRes.data}
    />
  )
}
