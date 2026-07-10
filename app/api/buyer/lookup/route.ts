import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { checkRateLimit, rateLimitHeaders } from '@/lib/utils/rateLimit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit par marchand : 30 recherches/minute (scan QR en caisse)
  const LIMIT = 30
  const rl = checkRateLimit(`lookup:user:${user.id}`, LIMIT, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite atteinte : ${LIMIT} recherches par minute. Réessayez dans ${rl.resetIn}s.` },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) }
    )
  }

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const phoneNorm = normalizePhone(phone)

  const service = createServiceClient()

  const { data: buyer } = await service
    .from('users')
    .select('id, full_name')
    .eq('phone', phoneNorm)
    .single()

  if (!buyer) return NextResponse.json({ found: false })

  const { data: wallet } = await service
    .from('wallets')
    .select('balance_fcfa, balance_gfp')
    .eq('user_id', buyer.id)
    .single()

  return NextResponse.json({
    found: true,
    userId: buyer.id,
    name: buyer.full_name,
    balance_fcfa: wallet?.balance_fcfa ?? 0,
    balance_gfp: wallet?.balance_gfp ?? 0,
  })
}
