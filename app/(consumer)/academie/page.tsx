import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AcademieClient from './AcademieClient'

export default async function AcademiePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  const [scoreRes, progressRes, budgetRes] = await Promise.all([
    svc.from('user_scores').select('*').eq('user_id', user.id).single(),
    svc.from('budget_formation_progress').select('*').eq('user_id', user.id).single(),
    svc.from('budget_profiles').select('*').eq('user_id', user.id).single(),
  ])

  return (
    <AcademieClient
      userId={user.id}
      initialScore={scoreRes.data ?? null}
      initialProgress={progressRes.data ?? null}
      initialBudgetProfile={budgetRes.data ?? null}
    />
  )
}
