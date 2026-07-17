/**
 * POST /api/cron/expire-bons
 *
 * Expire les bons d'achat GreenFlame non utilisés en fin de mois.
 * Les droits (voucher_rights_monthly) du mois passé sont également marqués 'expired'.
 * Perte sèche pour l'utilisateur — explicitement documenté dans les CGU.
 *
 * À appeler le 1er de chaque mois via Supabase pg_cron.
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()

  // 1. Expirer tous les bons dont expires_at est passé et statut encore actif/partiellement utilisé
  const { data: expiredBons, error: bonErr } = await svc
    .from('vouchers')
    .update({ status: 'expired', updated_at: now })
    .in('status', ['active', 'partially_used'])
    .lt('expires_at', now)
    .select('id')

  // 2. Expirer les pools de droits des mois passés (mois < mois courant)
  const currentMonth = now.slice(0, 7)  // 'YYYY-MM'
  const { data: expiredPools, error: poolErr } = await svc
    .from('voucher_rights_monthly')
    .update({ status: 'expired', expired_at: now, updated_at: now })
    .eq('status', 'active')
    .lt('month_year', currentMonth)
    .select('id')

  if (bonErr || poolErr) {
    return NextResponse.json({
      error: bonErr?.message ?? poolErr?.message,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok:            true,
    bonsExpirés:   expiredBons?.length  ?? 0,
    poolsExpirés:  expiredPools?.length ?? 0,
    executedAt:    now,
  })
}
