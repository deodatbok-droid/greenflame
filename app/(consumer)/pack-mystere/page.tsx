import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PackMystereClient from './PackMystereClient'

export default async function PackMysterePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PackMystereClient />
}
