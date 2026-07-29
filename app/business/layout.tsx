import type { ReactNode } from 'react'
import { getBizSession } from '@/lib/business/auth'
import BizSidebar from './BizSidebar'
import BizTopBar from './BizTopBar'
import BizCommandBar from './BizCommandBar'
import BizOnboarding from './BizOnboarding'
import './biz.css'

export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const session = await getBizSession()
  const { account, member } = session

  // Initiales utilisateur à partir du nom GreenFlame (ou user_id fallback)
  const userInitials = account.name
    ? account.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'GF'

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
          userRole={member.role}
        />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
      <BizCommandBar />
      <BizOnboarding businessId={account.id} />
    </div>
  )
}
