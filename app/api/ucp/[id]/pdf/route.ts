/**
 * GET /api/ucp/[id]/pdf
 *
 * Retourne le PDF du bulletin si disponible (statut "signed").
 * Redirige vers l'URL Supabase Storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: sub } = await svc
    .from('ucp_subscriptions')
    .select('user_id, status, pdf_url, bsd_number')
    .eq('id', id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })

  // Vérifier les droits : propriétaire ou admin
  const { data: profile } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')

  if (!isAdmin && sub.user_id !== user.id)
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  if (sub.status !== 'signed' || !sub.pdf_url)
    return NextResponse.json({
      error: 'PDF non disponible — le bulletin n\'est pas encore confirmé'
    }, { status: 404 })

  // Rediriger vers l'URL de stockage
  return NextResponse.redirect(sub.pdf_url)
}
