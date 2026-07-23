import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Verify application exists and is assigned to this agent
  const { data: app } = await svc
    .from('merchant_applications')
    .select('id, status, assigned_agent_id, user_id, business_name')
    .eq('id', id)
    .single()

  if (!app) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin && app.assigned_agent_id !== user.id) {
    return NextResponse.json({ error: 'Cette demande ne vous est pas assignée' }, { status: 403 })
  }

  if (['approved', 'rejected'].includes(app.status)) {
    return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 400 })
  }

  const formData = await req.formData()
  const notes             = (formData.get('notes') as string | null)?.trim() ?? ''
  const locationConfirmed = formData.get('location_confirmed') === 'true'
  const photoFile         = formData.get('photo') as File | null

  let visitPhotoPath: string | null = null

  if (photoFile && photoFile.size > 0) {
    const ext  = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `visits/${id}/photo_${Date.now()}.${ext}`
    const buf  = Buffer.from(await photoFile.arrayBuffer())
    const { error: uploadErr } = await svc.storage
      .from('merchant-documents')
      .upload(path, buf, { contentType: photoFile.type, upsert: true })
    if (!uploadErr) visitPhotoPath = path
  }

  const now = new Date().toISOString()

  await svc.from('merchant_applications').update({
    status:             'pending_admin',
    visit_notes:        notes || null,
    location_confirmed: locationConfirmed,
    visit_photo_path:   visitPhotoPath,
    visit_done_at:      now,
    updated_at:         now,
  }).eq('id', id)

  void insertNotification({
    userId:      app.user_id,
    type:        'merchant_visit_done',
    title:       'Visite terrain effectuée',
    body:        `La visite pour votre boutique "${app.business_name}" a été réalisée. Votre dossier est en cours d'examen final par notre équipe.`,
    referenceId: id,
  })

  return NextResponse.json({ ok: true })
}
