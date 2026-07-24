import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { sector_label, tool_slug } = body as { sector_label: string; tool_slug?: string | null }

    if (!sector_label?.trim()) {
      return NextResponse.json({ error: 'sector_label requis' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: merchant } = await svc
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single()

    if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

    await svc.from('tool_requests').insert({
      merchant_id: merchant.id,
      tool_slug:   tool_slug ?? null,
      sector_label: sector_label.trim(),
    })

    // Notifier l'admin
    const { data: upline } = await svc
      .from('users')
      .select('id')
      .contains('role', ['platform_upline'])
      .single()

    if (upline) {
      void insertNotification({
        userId: upline.id,
        type: 'subscription_paid',
        title: '🛠️ Demande outil sectoriel',
        body: `${merchant.business_name} demande un outil pour : ${sector_label}${tool_slug ? ` (slug: ${tool_slug})` : ''}.`,
        referenceId: merchant.id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tool-request] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
