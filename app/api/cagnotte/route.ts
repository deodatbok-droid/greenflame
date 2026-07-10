/**
 * GET /api/cagnotte — état de la cagnotte + éligibilité + contributeurs actifs
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getPotState,
  getUserEligibility,
  getUserConsolations,
} from '@/lib/cagnotte/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const [potState, eligibility, consolations, contributorsRes] = await Promise.all([
    getPotState(),
    getUserEligibility(user.id),
    getUserConsolations(user.id),
    svc.from('pot_eligible_members')
      .select('user_id, full_name')
      .limit(30),
  ])

  const contributors = (contributorsRes.data ?? []).map((c: { user_id: string; full_name: string | null }) => ({
    userId: c.user_id,
    initials: (c.full_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    name: c.full_name ?? 'Membre',
  }))

  return NextResponse.json({
    pot: potState,
    eligibility,
    consolations,
    contributors,
  })
}
