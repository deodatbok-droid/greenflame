import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { BizAccount } from '@/lib/business/auth'
import BizSidebar from './BizSidebar'
import BizTopBar from './BizTopBar'
import BizBottomNav from './BizBottomNav'
import BizCommandBar from './BizCommandBar'
import BizOnboarding from './BizOnboarding'
import './biz.css'

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()

  // Pas authentifié — le middleware gère la redirection vers /login,
  // on rend juste un wrapper minimal pour éviter une boucle.
  if (!user) {
    return (
      <div className="biz-root" style={{ minHeight: '100vh', background: '#EFF3F8', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </div>
    )
  }

  // Récupère le membre et son compte business sans appeler redirect()
  // (redirect() dans le layout créerait une boucle infinie avec la page onboarding)
  const { data: member } = await auth
    .from('biz_members')
    .select('role, permissions, business_id, biz_accounts(*)')
    .eq('user_id', user.id)
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const account = member
    ? (member as unknown as { biz_accounts: BizAccount }).biz_accounts
    : null

  // Pas de compte business — wrapper minimal pour la page onboarding
  if (!member || !account) {
    return (
      <div className="biz-root" style={{ minHeight: '100vh', background: '#EFF3F8', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </div>
    )
  }

  const userInitials = account.name
    ? account.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'GF'

  const memberRole = member.role as 'owner' | 'manager' | 'staff'

  return (
    <div className="biz-root" style={{ display: 'flex', minHeight: '100vh' }}>
      <BizSidebar
        accountName={account.name}
        plan={account.plan}
        userInitials={userInitials}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <BizTopBar
          accountName={account.name}
          userInitials={userInitials}
          userRole={memberRole}
        />
        <main className="biz-main" style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
      <BizBottomNav />
      <BizCommandBar />
      <BizOnboarding businessId={account.id} />
    </div>
  )
}
