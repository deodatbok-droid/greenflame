import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UcpClient from './UcpClient'

export default async function UcpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, ucp_unlocked')
    .eq('id', user.id)
    .single()

  const isAdmin     = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  const ucpUnlocked = isAdmin || !!profile?.ucp_unlocked

  if (!ucpUnlocked) redirect('/profile')

  return <UcpClient />
}
