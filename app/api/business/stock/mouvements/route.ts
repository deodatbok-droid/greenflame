import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: member } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (member.role === 'staff') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })

  const body = await req.json()
  const { move_type, reference, lines } = body

  if (!['in', 'out', 'adjustment'].includes(move_type)) {
    return NextResponse.json({ error: 'Type de mouvement invalide' }, { status: 400 })
  }
  if (!lines?.length) return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })

  const svc = createServiceClient()

  for (const line of lines) {
    const { product_id, qty, unit_cost, note } = line
    if (!product_id || !qty) continue

    // Enregistrer le mouvement
    await svc.from('biz_inventory_moves').insert({
      business_id: member.business_id,
      product_id,
      move_type,
      quantity: qty,
      unit_cost:  unit_cost || null,
      note:       note || reference || null,
      created_by: user.id,
    })

    // Mettre à jour le stock
    const { data: inv } = await svc
      .from('biz_inventory')
      .select('quantity, cmup')
      .eq('business_id', member.business_id)
      .eq('product_id', product_id)
      .maybeSingle()

    const currentQty  = (inv?.quantity as number) ?? 0
    const currentCmup = (inv?.cmup as number | null) ?? null

    let newQty  = currentQty
    let newCmup = currentCmup

    if (move_type === 'in') {
      newQty = currentQty + qty
      // Recalcul CMUP si coût fourni
      if (unit_cost) {
        const totalVal = (currentQty * (currentCmup ?? unit_cost)) + (qty * unit_cost)
        newCmup = newQty > 0 ? totalVal / newQty : unit_cost
      }
    } else if (move_type === 'out') {
      newQty = Math.max(0, currentQty - qty)
    } else if (move_type === 'adjustment') {
      newQty = qty
    }

    if (inv) {
      await svc.from('biz_inventory')
        .update({ quantity: newQty, ...(newCmup !== null ? { cmup: newCmup } : {}), updated_at: new Date().toISOString() })
        .eq('business_id', member.business_id)
        .eq('product_id', product_id)
    } else {
      await svc.from('biz_inventory')
        .insert({ business_id: member.business_id, product_id, quantity: newQty, cmup: newCmup })
    }
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
