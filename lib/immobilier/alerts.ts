import { createServiceClient } from '@/lib/supabase/server'
import { insertNotifications } from '@/lib/utils/notify'

interface ListedProperty {
  id: string
  title: string
  listing_type: string
  property_type: string
  price_fcfa: number
  city: string | null
  neighborhood: string | null
  rooms: number | null
  surface_m2: number | null
}

interface AlertRow {
  id: string
  user_id: string
  listing_type: string | null
  property_type: string | null
  city: string | null
  neighborhood: string | null
  price_min: number | null
  price_max: number | null
  rooms_min: number | null
  surface_min: number | null
}

function matches(alert: AlertRow, property: ListedProperty): boolean {
  if (alert.listing_type && alert.listing_type !== property.listing_type) return false
  if (alert.property_type && alert.property_type !== property.property_type) return false
  if (alert.city && property.city && alert.city.toLowerCase() !== property.city.toLowerCase()) return false
  if (alert.neighborhood && property.neighborhood && alert.neighborhood.toLowerCase() !== property.neighborhood.toLowerCase()) return false
  if (alert.price_min != null && property.price_fcfa < alert.price_min) return false
  if (alert.price_max != null && property.price_fcfa > alert.price_max) return false
  if (alert.rooms_min != null && (property.rooms == null || property.rooms < alert.rooms_min)) return false
  if (alert.surface_min != null && (property.surface_m2 == null || property.surface_m2 < alert.surface_min)) return false
  return true
}

// À appeler uniquement à la transition d'un bien vers gf_listed=true && status='disponible'.
// Non-bloquant : les erreurs sont loggées, jamais renvoyées à l'appelant.
export async function notifyMatchingAlerts(property: ListedProperty): Promise<void> {
  try {
    const svc = createServiceClient()

    const { data: alerts } = await svc
      .from('property_alerts')
      .select('id, user_id, listing_type, property_type, city, neighborhood, price_min, price_max, rooms_min, surface_min')
      .eq('active', true)

    if (!alerts?.length) return

    const candidateIds = [...new Set(alerts.map(a => a.user_id))]
    const { data: passes } = await svc
      .from('buyer_passes')
      .select('user_id')
      .in('user_id', candidateIds)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())

    const activeUserIds = new Set((passes ?? []).map(p => p.user_id))
    const winners = alerts.filter(a => activeUserIds.has(a.user_id) && matches(a, property))
    if (!winners.length) return

    await insertNotifications(winners.map(a => ({
      userId: a.user_id,
      type: 'property_alert_match',
      title: 'Nouveau bien correspondant à votre alerte',
      body: property.title,
      referenceId: property.id,
    })))
  } catch (err) {
    console.error('[notifyMatchingAlerts] error:', err)
  }
}

export function isPubliclyListed(gfListed: boolean | null | undefined, status: string | null | undefined): boolean {
  return gfListed === true && status === 'disponible'
}
