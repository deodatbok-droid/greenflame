import { createServiceClient } from '@/lib/supabase/server'
import UsersTable from './UsersTable'
import { requireAdmin } from '@/lib/utils/admin-guard'
import Link from 'next/link'

export default async function AdminUsersPage() {
  await requireAdmin()

  const svc = createServiceClient()

  const [usersRes, walletsRes] = await Promise.all([
    svc.from('users').select('id, full_name, phone, role, referral_code, created_at').order('created_at', { ascending: false }),
    svc.from('wallets').select('user_id, balance_fcfa, total_earned_fcfa'),
  ])

  const walletMap = Object.fromEntries((walletsRes.data ?? []).map(w => [w.user_id, w]))

  const userList = (usersRes.data ?? []).map(u => ({
    ...u,
    balance_fcfa: walletMap[u.id]?.balance_fcfa ?? null,
    total_earned_fcfa: walletMap[u.id]?.total_earned_fcfa ?? null,
  }))

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Membres</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Membres</h1>
        <p className="text-gray-400 text-sm mt-1">{userList.length} compte(s) enregistré(s)</p>
      </div>
      <UsersTable users={userList} />
    </div>
  )
}
