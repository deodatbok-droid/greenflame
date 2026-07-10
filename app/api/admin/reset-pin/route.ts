import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/admin-guard'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { targetUserId } = await req.json()
  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId requis' }, { status: 400 })
  }

  // Get the admin's identity for audit trail
  const supabase = await createClient()
  const { data: { user: admin } } = await supabase.auth.getUser()

  // Use service client to bypass RLS
  const service = createServiceClient()

  const { error } = await service
    .from('users')
    .update({ transaction_pin: null })
    .eq('id', targetUserId)

  if (error) {
    console.error('[reset-pin] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[reset-pin] Admin ${admin?.id} reset PIN for user ${targetUserId}`)

  return NextResponse.json({ success: true })
}
