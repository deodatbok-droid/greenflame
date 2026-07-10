/**
 * GET /api/internal/flamme-inactivity-warning
 *
 * Alerte WhatsApp pré-rupture Flamme — appelée chaque nuit par Vercel Cron
 * (voir vercel.json), séparément du pg_cron qui applique la démotion elle-
 * même (migration 053, public.flamme_inactivity_cron()). Cette route ne
 * démote jamais personne : elle prévient seulement les utilisateurs qui
 * entrent dans la fenêtre d'alerte (45-59 jours d'inactivité, voir
 * getInactivityStatus dans lib/flamme/engine.ts) qu'ils vont perdre leur
 * rang s'ils restent inactifs — un risque réel, jamais une promesse.
 *
 * Throttle : un seul envoi par fenêtre d'inactivité, via
 * user_flammes.last_inactivity_warning_at (migration 059). On ne renvoie
 * pas tant que la dernière alerte est postérieure à la dernière activité
 * connue — dès qu'un utilisateur redevient actif puis re-tombe inactif,
 * une nouvelle alerte redevient possible.
 *
 * Authentification : même pattern dual que compute-ai-profiles — Bearer
 * CRON_SECRET (Vercel Cron) ou x-internal-secret (legacy/manuel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { RANG_CONFIG, getInactivityStatus } from '@/lib/flamme/engine'
import { sendWhatsApp, waFlammeInactivityWarning } from '@/lib/whatsapp/wasender'

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get('authorization') ?? ''
  const xInternal   = req.headers.get('x-internal-secret') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  const authorized =
    (!!bearerToken && (bearerToken === process.env.CRON_SECRET || bearerToken === process.env.INTERNAL_API_SECRET)) ||
    (!!xInternal && xInternal === process.env.INTERNAL_API_SECRET)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()

  const { data: rows } = await svc
    .from('user_flammes')
    .select('user_id, rang, last_fa_event_at, last_connection_at, last_inactivity_warning_at, users:user_id(full_name, phone)')
    .neq('rang', 'étincelle') // rien à perdre au rang le plus bas — pas d'alerte

  if (!rows?.length) {
    return NextResponse.json({ message: 'Aucun utilisateur à risque', sent: 0, skipped: 0, errors: 0 })
  }

  let sent = 0, skipped = 0, errors = 0

  for (const row of rows) {
    try {
      const status = getInactivityStatus(row as { last_fa_event_at: string | null; last_connection_at: string | null; rang: string })
      if (!status.inWarningWindow) { skipped++; continue }

      const lastActive = row.last_fa_event_at || row.last_connection_at
      if (row.last_inactivity_warning_at && lastActive && new Date(row.last_inactivity_warning_at) > new Date(lastActive)) {
        skipped++ // déjà alerté pendant cette même fenêtre d'inactivité
        continue
      }

      const userRow = row.users as unknown as { full_name: string | null; phone: string | null } | null
      if (!userRow?.phone) { skipped++; continue }

      const rangConfig = RANG_CONFIG.find(r => r.rang === row.rang)
      if (!rangConfig) { skipped++; continue }

      const firstName = (userRow.full_name ?? '').split(' ')[0] || 'là'

      await sendWhatsApp(userRow.phone, waFlammeInactivityWarning({
        firstName,
        rangLabel: rangConfig.label,
        rangEmoji: rangConfig.emoji,
        daysLeft: status.daysUntilDemotion ?? 0,
      }))

      await svc.from('user_flammes').update({ last_inactivity_warning_at: now.toISOString() }).eq('user_id', row.user_id)
      sent++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ success: true, timestamp: now.toISOString(), sent, skipped, errors })
}
