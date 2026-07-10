/**
 * notify — helper serveur pour insérer des notifications utilisateur
 * Utilise le service client (bypass RLS) — toujours appelé côté serveur.
 * Non-bloquant : les erreurs sont loggées mais ne font pas échouer l'opération parente.
 */
import { createServiceClient } from '@/lib/supabase/server'

interface NotifInput {
  userId: string
  type: string
  title: string
  body: string
  referenceId?: string | null
}

export async function insertNotification(notif: NotifInput): Promise<void> {
  const svc = createServiceClient()
  const { error } = await svc.from('notifications').insert({
    user_id:      notif.userId,
    type:         notif.type,
    title:        notif.title,
    body:         notif.body,
    reference_id: notif.referenceId ?? null,
  })
  if (error) console.error('[notify] insert error:', error.message)
}

export async function insertNotifications(notifs: NotifInput[]): Promise<void> {
  if (notifs.length === 0) return
  const svc = createServiceClient()
  const { error } = await svc.from('notifications').insert(
    notifs.map(n => ({
      user_id:      n.userId,
      type:         n.type,
      title:        n.title,
      body:         n.body,
      reference_id: n.referenceId ?? null,
    }))
  )
  if (error) console.error('[notify] batch insert error:', error.message)
}
