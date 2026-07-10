import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/vouchers/[code] — lookup par le marchand avant encaissement
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await params
  const svc = createServiceClient()

  const { data: voucher } = await svc
    .from('withdrawal_vouchers')
    .select('id, amount_fcfa, status, note, expires_at, sender_id, users!sender_id(full_name)')
    .eq('code', code.toUpperCase())
    .single()

  if (!voucher) return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 })

  // Vérifier expiration
  if (new Date(voucher.expires_at) < new Date()) {
    await svc.from('withdrawal_vouchers').update({ status: 'expired' }).eq('code', code.toUpperCase())
    return NextResponse.json({ error: 'Ce bon a expiré' }, { status: 410 })
  }

  if (voucher.status !== 'active') {
    return NextResponse.json({
      error: voucher.status === 'redeemed' ? 'Ce bon a déjà été encaissé' : 'Ce bon est annulé',
    }, { status: 409 })
  }

  const sender = voucher.users as unknown as { full_name: string } | null

  return NextResponse.json({
    valid: true,
    code: code.toUpperCase(),
    amount_fcfa: voucher.amount_fcfa,
    sender_name: sender?.full_name ?? 'Inconnu',
    note: voucher.note,
    expires_at: voucher.expires_at,
  })
}
