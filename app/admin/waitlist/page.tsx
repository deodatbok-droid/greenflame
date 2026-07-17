import { createServiceClient } from '@/lib/supabase/server'
import WaitlistAdminClient from './WaitlistAdminClient'

export default async function AdminWaitlistPage() {
  const svc = createServiceClient()

  const { data: entries } = await svc
    .from('waitlist_entries')
    .select('id, first_name, last_name, email, whatsapp, role, referral_code, created_at, referred_by_id')
    .order('created_at', { ascending: false })
    .limit(500)

  // Résoudre les prénoms des parrains
  const referrerIds = [...new Set((entries ?? []).map(e => e.referred_by_id).filter(Boolean))] as string[]
  let referrerMap: Record<string, string> = {}
  if (referrerIds.length > 0) {
    const { data: referrers } = await svc
      .from('waitlist_entries')
      .select('id, first_name, last_name')
      .in('id', referrerIds)
    referrerMap = Object.fromEntries(
      (referrers ?? []).map(r => [r.id, `${r.first_name} ${r.last_name}`])
    )
  }

  const enriched = (entries ?? []).map(e => ({
    ...e,
    referrer_name: e.referred_by_id ? (referrerMap[e.referred_by_id] ?? '—') : null,
  }))

  return <WaitlistAdminClient entries={enriched} />
}
