/**
 * GET  /api/vouchers        — pool mensuel disponible + bons actifs
 * POST /api/vouchers/emit   — émettre un bon depuis le pool mensuel
 * POST /api/vouchers/redeem — utiliser un bon chez un marchand
 * POST /api/vouchers/gift   — offrir un bon à un membre ou non-membre
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

// ─── GET — solde + bons actifs ────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc       = createServiceClient()
  const monthYear = new Date().toISOString().slice(0, 7)

  // Pool mensuel
  const { data: rights } = await svc
    .from('voucher_rights_monthly')
    .select('total_fcfa, emitted_fcfa, status')
    .eq('user_id', user.id)
    .eq('month_year', monthYear)
    .maybeSingle()

  const totalFcfa    = rights?.total_fcfa    ?? 0
  const emittedFcfa  = rights?.emitted_fcfa  ?? 0
  const availableFcfa = Math.max(0, totalFcfa - emittedFcfa)

  // Bons actifs de cet utilisateur
  const { data: vouchers } = await svc
    .from('vouchers')
    .select('id, code, amount_fcfa, remaining_fcfa, status, expires_at, gift_recipient_phone, gift_recipient_email, created_at')
    .eq('issued_by_id', user.id)
    .in('status', ['active', 'partially_used'])
    .order('created_at', { ascending: false })
    .limit(20)

  // Bons reçus en cadeau (owner = moi, issued_by != moi)
  const { data: received } = await svc
    .from('vouchers')
    .select('id, code, amount_fcfa, remaining_fcfa, status, expires_at, created_at')
    .eq('owner_id', user.id)
    .neq('issued_by_id', user.id)
    .in('status', ['active', 'partially_used'])
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    monthYear,
    pool: { totalFcfa, emittedFcfa, availableFcfa, status: rights?.status ?? 'none' },
    vouchers:  vouchers  ?? [],
    received:  received  ?? [],
  })
}
