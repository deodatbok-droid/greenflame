/**
 * POST /api/pack-mystere/acheter — achat d'un Pack Mystère
 * Body : { tier: 'bronze' | 'argent' | 'or' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { purchasePack, type PackTier } from '@/lib/pack-mystere/engine'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tier = body.tier as PackTier

  const validTiers: PackTier[] = ['bronze', 'argent', 'or']
  if (!validTiers.includes(tier)) {
    return NextResponse.json({ error: 'Tier invalide. Choisir : bronze, argent ou or.' }, { status: 400 })
  }

  try {
    const result = await purchasePack(user.id, tier)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur achat pack'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
