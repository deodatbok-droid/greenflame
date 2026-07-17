import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: providers, error } = await svc
    .from('delivery_providers')
    .select('id, display_name, phone, service_area, base_fee_fcfa, fee_per_km, avg_rating, nb_deliveries, is_verified')
    .eq('is_active', true)
    .order('nb_deliveries', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ providers: providers ?? [] })
}
