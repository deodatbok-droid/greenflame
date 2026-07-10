import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ id: string }> }

// ── GET — retourner l'overlay produit d'une tontine (+ bons de livraison) ───
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tontine_products')
    .select('*, tontine_delivery_orders(*)')
    .eq('tontine_id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// ── POST — attacher un produit à une tontine (appelé juste après création) ──
export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { product_id, merchant_id, product_name, unit_price_fcfa } = body

  if (!product_id || !merchant_id || !product_name || !unit_price_fcfa) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  // Vérification : l'appelant est bien le créateur de cette tontine
  const { data: tontine } = await supabase
    .from('tontines')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (!tontine || tontine.creator_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tontine_products')
    .insert({ tontine_id: id, product_id, merchant_id, product_name, unit_price_fcfa })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// ── PATCH — validation marchand OU mise à jour bon de livraison ──────────────
export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { action, delivery_order_id, status: deliveryStatus, notes } = body

  // ── Action : le marchand valide la tontine (confirme disponibilité du stock)
  if (action === 'validate') {
    const { data: tp } = await supabase
      .from('tontine_products')
      .select('merchant_id')
      .eq('tontine_id', id)
      .single()

    if (!tp) return NextResponse.json({ error: 'Overlay produit introuvable' }, { status: 404 })

    // Vérifier que le user est bien le marchand concerné
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', tp.merchant_id)
      .single()

    if (!merchant) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data, error } = await supabase
      .from('tontine_products')
      .update({ validated_at: new Date().toISOString(), stock_committed: true })
      .eq('tontine_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── Action : le marchand met à jour un bon de livraison
  if (action === 'delivery_update' && delivery_order_id && deliveryStatus) {
    const allowed = ['en_attente', 'prepare', 'livre', 'annule']
    if (!allowed.includes(deliveryStatus)) {
      return NextResponse.json({ error: 'Statut de livraison invalide' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { status: deliveryStatus }
    if (deliveryStatus === 'livre') updates.delivered_at = new Date().toISOString()
    if (deliveryStatus === 'prepare') updates.notified_at = new Date().toISOString()
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('tontine_delivery_orders')
      .update(updates)
      .eq('id', delivery_order_id)
      .eq('tontine_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Action inconnue ou paramètres manquants' }, { status: 400 })
}
