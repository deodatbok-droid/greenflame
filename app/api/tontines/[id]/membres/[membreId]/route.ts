import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateTontineConversation, postSystemMessage } from '@/lib/messaging/conversations'

interface RouteParams {
  params: Promise<{ id: string; membreId: string }>
}

interface PatchBody {
  full_name?: string
  phone?: string
  position?: number
  has_received_pot?: boolean
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, membreId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // verify creator
  const { data: tontine } = await supabase
    .from('tontines')
    .select('id, name')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body: PatchBody = await req.json()
  const updates: PatchBody = {}
  if (body.full_name !== undefined)       updates.full_name = body.full_name
  if (body.phone !== undefined)           updates.phone = body.phone
  if (body.position !== undefined)        updates.position = body.position
  if (body.has_received_pot !== undefined) updates.has_received_pot = body.has_received_pot

  // Capturé avant l'update pour détecter une vraie transition false→true —
  // sans ça un PATCH répété avec has_received_pot déjà à true redéclencherait
  // l'annonce à chaque sauvegarde.
  let wasReceivedBefore = false
  if (body.has_received_pot === true) {
    const { data: before } = await supabase
      .from('tontine_membres')
      .select('has_received_pot')
      .eq('id', membreId)
      .eq('tontine_id', id)
      .maybeSingle()
    wasReceivedBefore = !!before?.has_received_pot
  }

  const { data, error } = await supabase
    .from('tontine_membres')
    .update(updates)
    .eq('id', membreId)
    .eq('tontine_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Preuve sociale + bon de livraison (tontine-produit)
  if (body.has_received_pot === true && !wasReceivedBefore) {
    try {
      const svc = createServiceClient()

      // Preuve sociale dans le fil de groupe
      const conv = await getOrCreateTontineConversation(svc, id, user.id)
      if (!('error' in conv)) {
        const memberName = (data as { full_name?: string } | null)?.full_name ?? 'Un membre'
        await postSystemMessage(
          svc,
          conv.conversationId,
          `🤝 *${memberName}* a reçu le pot de ce tour dans la tontine « ${tontine.name} » !`,
        )
      }

      // Si tontine-produit : créer automatiquement un bon de livraison
      const { data: tontineType } = await svc
        .from('tontines')
        .select('type')
        .eq('id', id)
        .single()

      if (tontineType?.type === 'produit') {
        // Calculer le numéro de cycle = nombre de membres ayant déjà reçu leur produit
        const { count } = await svc
          .from('tontine_membres')
          .select('id', { count: 'exact', head: true })
          .eq('tontine_id', id)
          .eq('has_received_pot', true)

        const cycleNumber = (count ?? 0) // l'update est déjà fait, ce membre est inclus dans le count

        await svc
          .from('tontine_delivery_orders')
          .upsert(
            { tontine_id: id, membre_id: membreId, cycle_number: cycleNumber, status: 'en_attente' },
            { onConflict: 'tontine_id,cycle_number', ignoreDuplicates: true }
          )
      }
    } catch {
      // silencieux — preuve sociale et bon de livraison ne bloquent jamais l'update métier
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, membreId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: tontine } = await supabase
    .from('tontines')
    .select('id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!tontine) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { error } = await supabase
    .from('tontine_membres')
    .delete()
    .eq('id', membreId)
    .eq('tontine_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
