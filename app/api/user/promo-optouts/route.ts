import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — liste des marchands avec statut opt-out pour l'utilisateur connecté
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  // Marchands distincts chez qui l'utilisateur a acheté
  const { data: txs } = await svc
    .from('transactions')
    .select('merchant_id')
    .eq('buyer_id', user.id)
    .eq('status', 'completed')

  const merchantIds = [...new Set((txs ?? []).map(t => t.merchant_id))]
  if (merchantIds.length === 0) return NextResponse.json({ merchants: [] })

  const [merchantsRes, optOutsRes] = await Promise.all([
    svc.from('merchants').select('id, business_name, public_slug').in('id', merchantIds),
    svc.from('promo_opt_outs').select('merchant_id').eq('user_id', user.id).in('merchant_id', merchantIds),
  ])

  const optedOut = new Set((optOutsRes.data ?? []).map(o => o.merchant_id))

  const merchants = (merchantsRes.data ?? []).map(m => ({
    id:            m.id,
    business_name: m.business_name,
    public_slug:   m.public_slug ?? null,
    opted_out:     optedOut.has(m.id),
  }))

  return NextResponse.json({ merchants })
}

// POST — toggler l'opt-out pour un marchand donné
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null) as { merchant_id?: string; opted_out?: boolean } | null
  const { merchant_id, opted_out } = body ?? {}
  if (!merchant_id || typeof opted_out !== 'boolean') {
    return NextResponse.json({ error: 'merchant_id et opted_out requis' }, { status: 400 })
  }

  const svc = createServiceClient()

  if (opted_out) {
    await svc.from('promo_opt_outs').upsert(
      { user_id: user.id, merchant_id },
      { onConflict: 'user_id,merchant_id', ignoreDuplicates: true }
    )
  } else {
    await svc.from('promo_opt_outs').delete()
      .eq('user_id', user.id)
      .eq('merchant_id', merchant_id)
  }

  return NextResponse.json({ ok: true, opted_out })
}
