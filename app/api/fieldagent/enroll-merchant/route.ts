import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role, full_name').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const formData         = await req.formData()
  const phone            = (formData.get('phone') as string | null)?.trim() ?? ''
  const businessName     = (formData.get('business_name') as string | null)?.trim() ?? ''
  const businessCategory = (formData.get('business_category') as string | null)?.trim() ?? ''
  const addressText      = (formData.get('address_text') as string | null)?.trim() ?? ''
  const city             = (formData.get('city') as string | null)?.trim() || null
  const neighborhood     = (formData.get('neighborhood') as string | null)?.trim() || null
  const ifu              = (formData.get('ifu') as string | null)?.trim() || null
  const rccm             = (formData.get('rccm') as string | null)?.trim() || null
  const ifuDoc           = formData.get('ifu_doc') as File | null
  const rccmDoc          = formData.get('rccm_doc') as File | null

  if (!phone || !businessName || !businessCategory || !addressText) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const phoneNorm = normalizePhone(phone)
  const { data: targetUser } = await svc
    .from('users')
    .select('id, full_name, kyc_level')
    .eq('phone', phoneNorm)
    .maybeSingle()

  if (!targetUser) return NextResponse.json({ error: 'Aucun compte GreenFlame pour ce numéro' }, { status: 404 })
  if ((targetUser.kyc_level ?? 0) < 1) {
    return NextResponse.json({ error: 'Le KYC de cet utilisateur doit être validé avant de devenir marchand' }, { status: 400 })
  }

  // Vérifier pas de demande active
  const { data: existing } = await svc
    .from('merchant_applications')
    .select('id, status')
    .eq('user_id', targetUser.id)
    .not('status', 'eq', 'rejected')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      error: `Une demande est déjà en cours (statut : ${existing.status})`,
    }, { status: 409 })
  }

  // Récupérer les chemins KYC (CNI) depuis la soumission approuvée
  const { data: kyc } = await svc
    .from('kyc_submissions')
    .select('front_path, back_path')
    .eq('user_id', targetUser.id)
    .eq('status', 'approved')
    .maybeSingle()

  // Upload IFU doc
  let ifuDocPath: string | null = null
  if (ifuDoc && ifuDoc.size > 0) {
    const ext = ifuDoc.name.split('.').pop() ?? 'jpg'
    const path = `merchants/${targetUser.id}/ifu_${Date.now()}.${ext}`
    const buf = Buffer.from(await ifuDoc.arrayBuffer())
    const { error: e } = await svc.storage.from('merchant-documents').upload(path, buf, { contentType: ifuDoc.type })
    if (!e) ifuDocPath = path
  }

  // Upload RCCM doc
  let rccmDocPath: string | null = null
  if (rccmDoc && rccmDoc.size > 0) {
    const ext = rccmDoc.name.split('.').pop() ?? 'jpg'
    const path = `merchants/${targetUser.id}/rccm_${Date.now()}.${ext}`
    const buf = Buffer.from(await rccmDoc.arrayBuffer())
    const { error: e } = await svc.storage.from('merchant-documents').upload(path, buf, { contentType: rccmDoc.type })
    if (!e) rccmDocPath = path
  }

  const now = new Date().toISOString()

  const { error: insertErr } = await svc.from('merchant_applications').insert({
    user_id:            targetUser.id,
    assigned_agent_id:  user.id,
    status:             'pending_admin',
    business_name:      businessName,
    business_category:  businessCategory,
    address_text:       addressText,
    city,
    neighborhood,
    ifu,
    rccm,
    kyc_front_path:     kyc?.front_path ?? null,
    kyc_back_path:      kyc?.back_path ?? null,
    ifu_doc_path:       ifuDocPath,
    rccm_doc_path:      rccmDocPath,
    location_confirmed: true,
    visit_done_at:      now,
    assigned_at:        now,
    visit_notes:        `Enrôlement terrain par l'agent ${me?.full_name ?? 'terrain'}`,
  })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  void insertNotification({
    userId:  targetUser.id,
    type:    'merchant_application_submitted',
    title:   'Demande boutique soumise',
    body:    `Votre dossier marchand pour "${businessName}" a été enregistré par notre équipe terrain. En attente de validation finale.`,
  })

  return NextResponse.json({ ok: true })
}
