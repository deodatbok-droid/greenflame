/**
 * POST /api/cron/flamme-inactivity
 * Appelé quotidiennement par Supabase pg_cron via pg_net.
 * Descend d'un rang les utilisateurs inactifs depuis 60 jours.
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { applyInactivityCheck } from '@/lib/flamme/engine'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const svc = createServiceClient()
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Utilisateurs inactifs depuis 60 jours ET rang > étincelle
  const { data: candidates } = await svc
    .from('user_flammes')
    .select('user_id, rang, last_fa_event_at, last_connection_at')
    .neq('rang', 'étincelle')
    .or(`last_fa_event_at.lt.${cutoff},last_fa_event_at.is.null`)
    .or(`last_connection_at.lt.${cutoff},last_connection_at.is.null`)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ demoted: 0 })
  }

  let demoted = 0
  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      await applyInactivityCheck(candidate.user_id)
      demoted++
    } catch (err) {
      errors.push(`${candidate.user_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ demoted, candidates: candidates.length, errors })
}
