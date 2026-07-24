import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import GlobalVoiceNav from '@/components/consumer/GlobalVoiceNav'
import { cookies, headers } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) redirect('/dashboard')

  const [cookieStore, headersList] = await Promise.all([cookies(), headers()])
  const adminCookie = cookieStore.get('gf_admin_verified')
  const isVerified  = adminCookie?.value?.startsWith(user.id)
  const pathname    = headersList.get('x-pathname') ?? ''
  const isVerifyPage = pathname.includes('/admin/verify')

  if (!isVerified && !isVerifyPage) redirect('/admin/verify')
  if (isVerifyPage) return <>{children}</>

  return (
    <>
      <AdminShell userName={profile?.full_name ?? ''}>
        {children}
      </AdminShell>
      <GlobalVoiceNav />
    </>
  )
}
