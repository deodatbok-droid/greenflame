/**
 * POST /api/bons/emit
 *
 * Émet un bon d'achat depuis le pool mensuel de l'utilisateur.
 * Body: { amountFcfa: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body        = await req.json().catch(() => ({}))
  const amountFcfa  = Number(body.amountFcfa)

  if (!amountFcfa || amountFcfa <= 0 || !Number.isInteger(amountFcfa)) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  const svc       = createServiceClient()
  const monthYear = new Date().toISOString().slice(0, 7)

  // Lire le pool disponible
  const { data: rights } = await svc
    .from('voucher_rights_monthly')
    .select('id, total_fcfa, emitted_fcfa, status')
    .eq('user_id', user.id)
    .eq('month_year', monthYear)
    .eq('status', 'active')
    .maybeSingle()

  if (!rights) {
    return NextResponse.json({ error: 'Aucun droit aux bons d\'achat ce mois-ci' }, { status: 400 })
  }

  const available = rights.total_fcfa - rights.emitted_fcfa
  if (amountFcfa > available) {
    return NextResponse.json({
      error: `Montant demandé (${amountFcfa} FCFA) supérieur au disponible (${available} FCFA)`,
      available,
    }, { status: 400 })
  }

  // Expiration : dernier instant du mois courant
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const expiresAt = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()

  // Incrémenter atomiquement (garde optimiste sur emitted_fcfa)
  const { error: updateErr } = await svc
    .from('voucher_rights_monthly')
    .update({
      emitted_fcfa: rights.emitted_fcfa + amountFcfa,
      updated_at:   now.toISOString(),
    })
    .eq('id', rights.id)
    .eq('emitted_fcfa', rights.emitted_fcfa)

  if (updateErr) {
    return NextResponse.json({ error: 'Conflit concurrent — réessayez' }, { status: 409 })
  }

  // Créer le bon
  const { data: bon, error: bonErr } = await svc
    .from('vouchers')
    .insert({
      owner_id:       user.id,
      issued_by_id:   user.id,
      rights_id:      rights.id,
      amount_fcfa:    amountFcfa,
      remaining_fcfa: amountFcfa,
      status:         'active',
      expires_at:     expiresAt,
    })
    .select('id, code, amount_fcfa, remaining_fcfa, expires_at')
    .single()

  if (bonErr || !bon) {
    // Rollback
    await svc.from('voucher_rights_monthly').update({
      emitted_fcfa: rights.emitted_fcfa,
    }).eq('id', rights.id)
    return NextResponse.json({ error: 'Erreur création bon' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bon })
}
