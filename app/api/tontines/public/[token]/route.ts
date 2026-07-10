import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET — vue publique en lecture seule d'une tontine via son share_token (pas d'authentification)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 })

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('tontines')
    .select(`
      id, name, description, contribution_amount_fcfa, frequency, start_date, status, created_at,
      tontine_membres (
        id, full_name, position, has_received_pot,
        tontine_cotisations ( id, periode, amount_fcfa, late_fee_fcfa, status, paid_at )
      )
    `)
    .eq('share_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Tontine introuvable' }, { status: 404 })

  return NextResponse.json(data)
}
