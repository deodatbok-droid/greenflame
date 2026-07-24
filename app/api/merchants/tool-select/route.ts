import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getToolBySlug } from '@/lib/merchant/tools-catalog'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { tool_slug, sector_label } = await req.json() as { tool_slug?: string; sector_label?: string }

    const svc = createServiceClient()

    const { data: merchant } = await svc
      .from('merchants')
      .select('id, business_name, subscription_tier, subscription_expires_at, is_platform_hub')
      .eq('user_id', user.id)
      .single()

    if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

    const now = new Date()
    const isVipActive = merchant.is_platform_hub || (
      merchant.subscription_tier === 'vip' &&
      merchant.subscription_expires_at !== null &&
      new Date(merchant.subscription_expires_at) > now
    )

    if (!isVipActive) {
      return NextResponse.json({ error: 'Plan VIP requis pour sélectionner un outil sectoriel.' }, { status: 403 })
    }

    if (!tool_slug && !sector_label) {
      return NextResponse.json({ error: 'tool_slug ou sector_label requis' }, { status: 400 })
    }

    if (tool_slug) {
      const tool = getToolBySlug(tool_slug)

      if (!tool) {
        return NextResponse.json({ error: 'Outil introuvable' }, { status: 404 })
      }

      if (tool.status === 'available') {
        // Calculer expiration = même date que l'abonnement VIP
        const expiresAt = merchant.subscription_expires_at
          ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        await svc.from('tool_subscriptions').upsert({
          merchant_id: merchant.id,
          tool_slug,
          plan:       'vip',
          started_at: now.toISOString(),
          expires_at: expiresAt,
        }, { onConflict: 'merchant_id,tool_slug' })

        return NextResponse.json({
          success: true,
          message: `Outil ${tool.label} activé avec succès !`,
        })
      } else {
        // Outil bientôt disponible → enregistrer la demande
        await svc.from('tool_requests').insert({
          merchant_id:  merchant.id,
          tool_slug,
          sector_label: tool.label,
        })

        const { data: upline } = await svc
          .from('users')
          .select('id')
          .contains('role', ['platform_upline'])
          .single()

        if (upline) {
          void insertNotification({
            userId: upline.id,
            type: 'subscription_paid',
            title: '🛠️ Demande outil bientôt dispo',
            body: `${merchant.business_name} a demandé l'outil "${tool.label}" (${tool_slug}).`,
            referenceId: merchant.id,
          })
        }

        return NextResponse.json({
          success: true,
          pending: true,
          message: `Demande enregistrée pour "${tool.label}". Vous serez notifié à la disponibilité.`,
        })
      }
    }

    // sector_label sans tool_slug → demande libre
    await svc.from('tool_requests').insert({
      merchant_id: merchant.id,
      tool_slug:   null,
      sector_label: (sector_label ?? '').trim(),
    })

    return NextResponse.json({ success: true, pending: true })
  } catch (err) {
    console.error('[tool-select] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
