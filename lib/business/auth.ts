import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface BizAccount {
  id: string
  name: string
  slug: string | null
  country: string
  currency: string
  plan: 'trial' | 'starter' | 'business' | 'pro'
  status: string
  owner_id: string
}

export interface BizSession {
  user:     { id: string; phone?: string }
  account:  BizAccount
  member:   { role: 'owner' | 'manager' | 'staff'; permissions: Record<string, unknown> }
}

/**
 * Récupère la session Business du user connecté.
 * Redirige vers /login si non authentifié, /business/onboarding si aucun compte business.
 */
export async function getBizSession(): Promise<BizSession> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await auth
    .from('biz_members')
    .select('role, permissions, business_id, biz_accounts(*)')
    .eq('user_id', user.id)
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/business/onboarding')

  const account = (member as unknown as { biz_accounts: BizAccount }).biz_accounts
  if (!account) redirect('/business/onboarding')

  return {
    user: { id: user.id, phone: user.phone },
    account,
    member: {
      role:        member.role as BizSession['member']['role'],
      permissions: (member.permissions ?? {}) as Record<string, unknown>,
    },
  }
}

/**
 * Vérifie le rôle — redirige si insuffisant.
 */
export function requireRole(session: BizSession, minimum: 'owner' | 'manager') {
  const rank = { owner: 2, manager: 1, staff: 0 }
  if (rank[session.member.role] < rank[minimum]) redirect('/business/dashboard')
}

/**
 * Formatage monétaire selon la devise du compte.
 */
export function formatBizAmount(amount: number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', {
    style:    'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Service client — pour les API routes Business.
 * Vérifie que l'utilisateur est membre du business avant de retourner.
 */
export async function getBizApiSession(businessId: string) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null

  const { data: member } = await auth
    .from('biz_members')
    .select('role, permissions')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return null
  return { user, member, svc: createServiceClient() }
}
