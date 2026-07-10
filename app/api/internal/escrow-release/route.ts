import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { distributeCommissions } from '@/lib/commission-engine/distribute'
import { sendWhatsApp } from '@/lib/whatsapp/wasender'

/**
 * GET /api/internal/escrow-release
 *
 * Cron job à appeler toutes les 2h.
 * Actions :
 *   – Notification 12h : avertir l'acheteur à ~12h après la mise en escrow
 *   – Notification 24h : second avertissement
 *   – Libération auto 48h : expiry passée → distributeCommissions + marquer released
 *
 * Sécurisé par INTERNAL_API_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET
  if (secret && req.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()

  // ── 1. Libération automatique : escrow_expires_at dépassé ─────────────
  const { data: expiredTxs } = await svc
    .from('transactions')
    .select('id, buyer_id, merchant_id, amount_fcfa, escrow_expires_at')
    .eq('escrow_status', 'held')
    .lte('escrow_expires_at', nowIso)

  let released = 0
  const releaseErrors: string[] = []

  for (const tx of expiredTxs ?? []) {
    // Marquer released avant la distribution (idempotence)
    await svc.from('transactions').update({
      escrow_status:        'released',
      delivery_confirmed_at: nowIso,
    }).eq('id', tx.id)

    await svc.from('delivery_orders').update({
      status:       'delivered',
      delivered_at: nowIso,
      updated_at:   nowIso,
    }).eq('transaction_id', tx.id)

    const result = await distributeCommissions(tx.id)
    if (!result.ok) {
      releaseErrors.push(`${tx.id}: ${result.error}`)
    } else {
      released++
      // Logger la notification de libération
      await svc.from('escrow_notifications').upsert({
        transaction_id: tx.id,
        notif_type:     'released',
        sent_at:        nowIso,
      }, { onConflict: 'transaction_id,notif_type' }).select()

      // Notifier l'acheteur (non-bloquant)
      ;(async () => {
        try {
          const { data: buyer } = await svc.from('users').select('phone, full_name').eq('id', tx.buyer_id).single()
          if (buyer?.phone) {
            sendWhatsApp(buyer.phone, `✅ GreenFlame — Fonds libérés\n\nBonjour ${buyer.full_name ?? ''},\n\nVotre commande de ${tx.amount_fcfa.toLocaleString('fr-FR')} FCFA a été confirmée automatiquement après 48h. Les fonds ont été distribués. Ubuntu en action 🌍\n\nRéf : #${tx.id.slice(0, 8).toUpperCase()}`)
          }
        } catch { /* non-bloquant */ }
      })()
    }
  }

  // ── 2. Notification 12h ───────────────────────────────────────────────
  const t12h = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
  const t14h = new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString()

  const { data: notif12hTxs } = await svc
    .from('transactions')
    .select('id, buyer_id, amount_fcfa, escrow_expires_at')
    .eq('escrow_status', 'held')
    .gte('created_at', t14h)   // créées il y a entre 12h et 14h
    .lte('created_at', t12h)

  // Exclure celles déjà notifiées à 12h
  const { data: alreadyNotif12h } = await svc
    .from('escrow_notifications')
    .select('transaction_id')
    .eq('notif_type', '12h')
    .in('transaction_id', (notif12hTxs ?? []).map(t => t.id))

  const notif12hExclude = new Set((alreadyNotif12h ?? []).map(n => n.transaction_id))

  let notified12h = 0
  for (const tx of (notif12hTxs ?? []).filter(t => !notif12hExclude.has(t.id))) {
    await svc.from('escrow_notifications').insert({
      transaction_id: tx.id,
      notif_type:     '12h',
      sent_at:        nowIso,
    })
    notified12h++

    ;(async () => {
      try {
        const { data: buyer } = await svc.from('users').select('phone, full_name').eq('id', tx.buyer_id).single()
        if (buyer?.phone) {
          const hoursLeft = Math.ceil((new Date(tx.escrow_expires_at!).getTime() - now.getTime()) / (60 * 60 * 1000))
          sendWhatsApp(buyer.phone, `📦 GreenFlame — Confirmez votre livraison\n\nBonjour ${buyer.full_name ?? ''},\n\nAvez-vous bien reçu votre commande de ${tx.amount_fcfa.toLocaleString('fr-FR')} FCFA ?\n\n✅ Si oui, confirmez ici : ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'}/delivery/confirm/${tx.id}\n\n⏳ Les fonds seront libérés automatiquement dans ${hoursLeft}h si vous ne confirmez pas.\n\n❌ Problème ? Ouvrez un litige avant la libération automatique.\n\nRéf : #${tx.id.slice(0, 8).toUpperCase()}`)
        }
      } catch { /* non-bloquant */ }
    })()
  }

  // ── 3. Notification 24h ───────────────────────────────────────────────
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const t26h = new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString()

  const { data: notif24hTxs } = await svc
    .from('transactions')
    .select('id, buyer_id, amount_fcfa, escrow_expires_at')
    .eq('escrow_status', 'held')
    .gte('created_at', t26h)
    .lte('created_at', t24h)

  const { data: alreadyNotif24h } = await svc
    .from('escrow_notifications')
    .select('transaction_id')
    .eq('notif_type', '24h')
    .in('transaction_id', (notif24hTxs ?? []).map(t => t.id))

  const notif24hExclude = new Set((alreadyNotif24h ?? []).map(n => n.transaction_id))

  let notified24h = 0
  for (const tx of (notif24hTxs ?? []).filter(t => !notif24hExclude.has(t.id))) {
    await svc.from('escrow_notifications').insert({
      transaction_id: tx.id,
      notif_type:     '24h',
      sent_at:        nowIso,
    })
    notified24h++

    ;(async () => {
      try {
        const { data: buyer } = await svc.from('users').select('phone, full_name').eq('id', tx.buyer_id).single()
        if (buyer?.phone) {
          sendWhatsApp(buyer.phone, `⚠️ GreenFlame — DERNIER rappel livraison\n\nBonjour ${buyer.full_name ?? ''},\n\nDernier rappel : avez-vous reçu votre commande de ${tx.amount_fcfa.toLocaleString('fr-FR')} FCFA ?\n\n✅ Confirmez ici : ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'}/delivery/confirm/${tx.id}\n\n⏳ ATTENTION : libération automatique dans 24h. Après ce délai, les fonds seront distribués sans votre confirmation.\n\n❌ Problème avec la livraison ? Ouvrez un litige maintenant.\n\nRéf : #${tx.id.slice(0, 8).toUpperCase()}`)
        }
      } catch { /* non-bloquant */ }
    })()
  }

  return NextResponse.json({
    ok:          true,
    released,
    notified12h,
    notified24h,
    releaseErrors: releaseErrors.length > 0 ? releaseErrors : undefined,
    checkedAt:   nowIso,
  })
}
