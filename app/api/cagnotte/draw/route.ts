/**
 * POST /api/cagnotte/draw — déclenche un tirage (admin uniquement)
 * Body : { amountFcfa?: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerDraw } from '@/lib/cagnotte/engine'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérification admin
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRow?.role?.includes('admin')) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const amountFcfa = body.amountFcfa ? Number(body.amountFcfa) : undefined

  try {
    const result = await triggerDraw(user.id, amountFcfa)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur tirage'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
