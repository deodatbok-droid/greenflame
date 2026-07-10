import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'
import { sendSms } from '@/lib/ussd/africastalking'

// ─── Garde de sécurité ───────────────────────────────────────────────────────
// Appelée automatiquement par Vercel Cron, qui envoie :
//   Authorization: Bearer <CRON_SECRET>
// (même mécanisme que /api/cron/daily-digest — voir vercel.json)
// On accepte aussi INTERNAL_API_SECRET pour les tests manuels (curl, etc.).
function authorize(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return false
  return token === process.env.CRON_SECRET || token === process.env.INTERNAL_API_SECRET
}

// ─── GET /api/internal/expiring-subscriptions?days=7 ─────────────────────────
// Retourne la liste des marchands dont l'abonnement expire dans exactement N jours.
// n8n appelle cet endpoint en cron quotidien pour J-7, J-3 et J-1.
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '7', 10)

  if (![1, 3, 7].includes(days)) {
    return NextResponse.json(
      { error: 'Le paramètre days doit être 1, 3 ou 7' },
      { status: 400 }
    )
  }

  const svc = createServiceClient()

  // Fenêtre : de minuit à 23h59 du jour J+N (UTC)
  const from = new Date()
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() + days)

  const to = new Date(from)
  to.setUTCHours(23, 59, 59, 999)

  const { data: merchants, error } = await svc
    .from('merchants')
    .select(`
      id,
      business_name,
      subscription_tier,
      subscription_expires_at,
      user_id,
      users!inner ( id, full_name, phone )
    `)
    .eq('is_active', true)
    .in('subscription_tier', ['pro', 'vip'])
    .gte('subscription_expires_at', from.toISOString())
    .lte('subscription_expires_at', to.toISOString())

  if (error) {
    console.error('[internal/expiring] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = (merchants ?? []).map((m: any) => ({
    merchant_id:            m.id,
    business_name:          m.business_name,
    subscription_tier:      m.subscription_tier,
    subscription_expires_at: m.subscription_expires_at,
    user_id:                m.users.id,
    full_name:              m.users.full_name,
    phone:                  m.users.phone,
    days_remaining:         days,
  }))

  return NextResponse.json({ count: result.length, merchants: result })
}

// ─── POST /api/internal/expiring-subscriptions ────────────────────────────────
// Envoie un rappel SMS + notification in-app à UN marchand identifié par merchant_id.
// n8n appelle cet endpoint pour chaque marchand retourné par le GET.
// Body : { merchant_id: string, days_remaining: 1 | 3 | 7 }
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json()
  const { merchant_id, days_remaining } = body as {
    merchant_id: string
    days_remaining: 1 | 3 | 7
  }

  if (!merchant_id || ![1, 3, 7].includes(days_remaining)) {
    return NextResponse.json(
      { error: 'merchant_id et days_remaining (1|3|7) requis' },
      { status: 400 }
    )
  }

  const svc = createServiceClient()

  const { data: m, error } = await svc
    .from('merchants')
    .select(`
      id,
      business_name,
      subscription_tier,
      subscription_expires_at,
      user_id,
      users!inner ( id, full_name, phone )
    `)
    .eq('id', merchant_id)
    .single()

  if (error || !m) {
    return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })
  }

  const merchant = m as any
  const tier = (merchant.subscription_tier as string).toUpperCase()
  const expiresAt = new Date(merchant.subscription_expires_at)
  const expiresStr = expiresAt.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // ── Textes selon l'urgence ─────────────────────────────────────────────────
  const messages: Record<number, { title: string; body: string; sms: string }> = {
    7: {
      title: `Votre abonnement ${tier} expire dans 7 jours`,
      body:  `Renouvelez votre abonnement ${tier} avant le ${expiresStr} pour conserver l'accès à toutes vos fonctionnalités GreenFlame.`,
      sms:   `[GreenFlame] Votre abonnement ${tier} expire le ${expiresStr} (dans 7 jours). Renouvelez vite depuis votre espace marchand.`,
    },
    3: {
      title: `Plus que 3 jours — renouvelez votre abonnement ${tier}`,
      body:  `Votre abonnement ${tier} expire le ${expiresStr}. Sans renouvellement, vous perdrez l'accès ${tier === 'VIP' ? 'aux Bons de Retrait et ' : ''}à vos outils marchands.`,
      sms:   `[GreenFlame] RAPPEL : abonnement ${tier} expire dans 3 jours (${expiresStr}). Renouvelez maintenant pour ne pas perdre vos avantages.`,
    },
    1: {
      title: `⚠️ Dernier jour — votre abonnement ${tier} expire demain`,
      body:  `Votre abonnement ${tier} expire demain (${expiresStr}). Renouvelez aujourd'hui pour éviter toute interruption de service.`,
      sms:   `[GreenFlame] URGENT : votre abonnement ${tier} expire DEMAIN. Renouvelez maintenant sur l'app GreenFlame.`,
    },
  }

  const msg = messages[days_remaining]

  // ── Notification in-app ────────────────────────────────────────────────────
  await insertNotification({
    userId:      merchant.users.id,
    type:        'subscription_expiring',
    title:       msg.title,
    body:        msg.body,
    referenceId: merchant.id,
  })

  // ── SMS (non-bloquant) ─────────────────────────────────────────────────────
  let smsSent = false
  let smsError: string | null = null

  if (merchant.users.phone) {
    try {
      await sendSms({ to: merchant.users.phone, message: msg.sms })
      smsSent = true
    } catch (err: any) {
      smsError = err?.message ?? 'Erreur SMS'
      console.error(`[internal/expiring] SMS failed for merchant ${merchant_id}:`, smsError)
    }
  }

  // ── Log dans une table d'audit (optionnel) ─────────────────────────────────
  try {
    await svc.from('platform_revenue_ledger').insert({
      source_type: 'automation_log',
      source_id:   merchant.id,
      amount_fcfa: 1, // valeur symbolique — entrée de log, pas de revenu réel
      description: `Rappel expiration ${tier} J-${days_remaining} envoyé à ${merchant.business_name} — SMS:${smsSent}`,
    })
  } catch { /* log non-bloquant */ }

  return NextResponse.json({
    success:        true,
    merchant_id,
    business_name:  merchant.business_name,
    days_remaining,
    notification:   true,
    sms_sent:       smsSent,
    sms_error:      smsError,
  })
}
