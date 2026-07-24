import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FieldAgentNav from './FieldAgentNav'

export default async function FieldAgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAgent = Array.isArray(profile?.role) && profile.role.includes('field_agent')
  if (!isAgent) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="pb-16">{children}</div>
      <FieldAgentNav />
    </div>
  )
}
