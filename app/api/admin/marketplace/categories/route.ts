import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/admin-guard'

// PATCH — mettre à jour image_url, is_active, sort_order d'une catégorie
export async function PATCH(req: NextRequest) {
  await requireAdmin()
  const svc = createServiceClient()
  const body = await req.json()
  const { id, image_url, is_active, sort_order } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (image_url   !== undefined) patch.image_url  = image_url
  if (is_active   !== undefined) patch.is_active  = is_active
  if (sort_order  !== undefined) patch.sort_order = sort_order

  const { error } = await svc
    .from('marketplace_categories')
    .update(patch)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
