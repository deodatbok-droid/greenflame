import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp, waParrainageReminder } from '@/lib/whatsapp/wasender'

// Vercel Cron — 9h30 UTC = 10h30 Cotonou (UTC+1)
// Cible : membres inscrits il y a 3 jours avec 0 filleul direct

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const svc = createServiceClient()

    const now     = new Date()
    const from    = new Date(now); from.setDate(now.getDate() - 4)
    const to      = new Date(now); to.setDate(now.getDate() - 3)

    // Membres inscrits entre J-4 et J-3
    const { data: users, error } = await svc
      .from('users')
      .select('id, phone, full_name, referral_code')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .not('phone', 'is', null)

    if (error) throw error
    if (!users?.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 })

    let sent = 0
    let skipped = 0

    for (const user of users) {
      // Vérifier si l'utilisateur a au moins 1 filleul direct
      const { count } = await svc
        .from('network_tree')
        .select('user_id', { count: 'exact', head: true })
        .eq('l1_upline', user.id)

      if ((count ?? 0) > 0) { skipped++; continue }

      const firstName = (user.full_name ?? '').split(' ')[0] || 'cher membre'
      await sendWhatsApp(user.phone!, waParrainageReminder({
        firstName,
        referralCode: user.referral_code ?? '',
      }))
      sent++
    }

    return NextResponse.json({ ok: true, sent, skipped })
  } catch (err) {
    console.error('[CRON/parrainage-reminder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
