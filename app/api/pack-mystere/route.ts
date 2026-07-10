/**
 * GET /api/pack-mystere — catalogue des packs + historique de l'utilisateur
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPackHistory } from '@/lib/pack-mystere/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: catalog } = await svc
    .from('pack_catalog')
    .select('id, tier, price_fcfa, fa_guaranteed, description_fr, sort_order, marketplace_product_id')
    .eq('is_active', true)
    .order('sort_order')

  const history = await getPackHistory(user.id)

  return NextResponse.json({
    catalog: catalog ?? [],
    history,
  })
}
