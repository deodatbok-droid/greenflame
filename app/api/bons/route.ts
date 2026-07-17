/**
 * GET /api/bons — pool mensuel de bons d'achat + bons actifs de l'utilisateur
 *
 * Les bons d'achat GreenFlame sont distincts des bons de retrait VIP (withdrawal_vouchers).
 * Ils proviennent de la redistribution communautaire : 30% de chaque dividende communautaire
 * reçu par un Cercle (L1-L5) constitue un droit aux bons d'achat valable ce mois-ci.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc       = createServiceClient()
  const monthYear = new Date().toISOString().slice(0, 7)

  const { data: rights } = await svc
    .from('voucher_rights_monthly')
    .select('total_fcfa, emitted_fcfa, status')
    .eq('user_id', user.id)
    .eq('month_year', monthYear)
    .maybeSingle()

  const totalFcfa     = rights?.total_fcfa    ?? 0
  const emittedFcfa   = rights?.emitted_fcfa  ?? 0
  const availableFcfa = Math.max(0, totalFcfa - emittedFcfa)

  const { data: bons } = await svc
    .from('vouchers')
    .select('id, code, amount_fcfa, remaining_fcfa, status, expires_at, gift_recipient_phone, gift_recipient_email, created_at')
    .or(`owner_id.eq.${user.id},issued_by_id.eq.${user.id}`)
    .in('status', ['active', 'partially_used'])
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({
    monthYear,
    pool: {
      totalFcfa,
      emittedFcfa,
      availableFcfa,
      status: rights?.status ?? 'none',
    },
    bons: bons ?? [],
  })
}
