import { createServiceClient } from '@/lib/supabase/server'
import WaitlistClient from './WaitlistClient'

export default async function PreInscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams

  const supabase = createServiceClient()

  const [countRes, referrerRes] = await Promise.all([
    supabase.from('waitlist_entries').select('*', { count: 'exact', head: true }),
    ref
      ? supabase
          .from('waitlist_entries')
          .select('first_name, last_name')
          .eq('referral_code', ref.toUpperCase())
          .single()
      : Promise.resolve({ data: null }),
  ])

  const totalCount = countRes.count ?? 0
  const referrerName = referrerRes.data
    ? `${referrerRes.data.first_name} ${referrerRes.data.last_name}`
    : null

  return (
    <WaitlistClient
      referralCode={ref ?? null}
      referrerName={referrerName}
      initialCount={totalCount}
    />
  )
}
