import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmployeeDetailClient from './EmployeeDetailClient'

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  return <EmployeeDetailClient employeeId={id} />
}
