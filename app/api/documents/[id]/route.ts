/**
 * /api/documents/[id] — Un document commercial précis
 * GET    — détail du document (avec ses lignes)
 * PATCH  — met à jour le statut et/ou les champs de suivi (paiement, échéance, lien vers un autre document…)
 * DELETE — supprime le document (et ses lignes en cascade)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getMerchantId(userId: string): Promise<string | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

const VALID_STATUSES = ['brouillon', 'envoye', 'accepte', 'paye', 'en_retard', 'annule']

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('commercial_documents')
    .select('*, commercial_document_lines(id, description, quantity, unit_price_fcfa, position)')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    status?: string
    notes?: string
    due_date?: string | null
    valid_until?: string | null
    linked_document_id?: string | null
  }

  const updates: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }
    updates.status = body.status
  }
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
  if (body.due_date !== undefined) updates.due_date = body.due_date || null
  if (body.valid_until !== undefined) updates.valid_until = body.valid_until || null
  if (body.linked_document_id !== undefined) updates.linked_document_id = body.linked_document_id || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('commercial_documents')
    .update(updates)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('*, commercial_document_lines(id, description, quantity, unit_price_fcfa, position)')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Document introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('commercial_documents')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
