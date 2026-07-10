import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const svc = createServiceClient()

  let body: {
    merchant_id: string
    amount_fcfa: number
    notes?: string
    entry_date?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { merchant_id, amount_fcfa, notes, entry_date } = body

  if (!merchant_id) return NextResponse.json({ error: 'merchant_id requis' }, { status: 400 })
  if (!amount_fcfa || amount_fcfa <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  // 1. Créer l'entrée float
  const { data: entry, error: entryError } = await svc
    .from('float_entries')
    .insert({
      entry_type:  'cash_collected',
      amount_fcfa,
      merchant_id,
      notes:       notes      || null,
      entry_date:  entry_date || new Date().toISOString().slice(0, 10),
      recorded_by: user.id,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    return NextResponse.json({ error: entryError?.message ?? 'Erreur création entrée' }, { status: 500 })
  }

  // 2. Marquer toutes les transactions cash non collectées de ce marchand comme collectées
  const { error: txError, data: markedTxs } = await svc
    .from('transactions')
    .update({
      float_collected:    true,
      float_collected_at: new Date().toISOString(),
      float_entry_id:     entry.id,
    })
    .eq('merchant_id', merchant_id)
    .eq('payment_method', 'cash_confirmed')
    .eq('status', 'completed')
    .eq('float_collected', false)
    .select('id')

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, entryId: entry.id, txMarked: markedTxs?.length ?? 0 })
}
