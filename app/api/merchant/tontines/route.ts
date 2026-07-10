import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET — toutes les tontines-produit liées aux articles de ce marchand ──────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Compte marchand introuvable' }, { status: 404 })

  const { data, error } = await supabase
    .from('tontine_products')
    .select(`
      *,
      tontines (
        id, name, contribution_amount_fcfa, frequency, status, start_date, created_at,
        tontine_membres (id, full_name, position, has_received_pot, status)
      ),
      tontine_delivery_orders (
        id, cycle_number, status, membre_id, notified_at, delivered_at, notes, created_at
      )
    `)
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
