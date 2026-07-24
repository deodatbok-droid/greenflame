import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function uploadFile(
  svc: ReturnType<typeof createServiceClient>,
  file: File,
  path: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null
  const bytes = await file.arrayBuffer()
  const { error } = await svc.storage
    .from('merchant-documents')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  return error ? null : path
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const uid = user.id

  // Vérifier qu'il n'y a pas déjà une demande active
  const { data: existing } = await svc
    .from('merchant_applications')
    .select('id, status')
    .eq('user_id', uid)
    .neq('status', 'rejected')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Une demande est déjà en cours', applicationId: existing.id }, { status: 400 })
  }

  // Vérifier qu'il n'est pas déjà marchand
  const { data: merchantRow } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle()

  if (merchantRow) {
    return NextResponse.json({ error: 'Vous êtes déjà marchand GreenFlame' }, { status: 400 })
  }

  const form = await req.formData()

  const businessName    = (form.get('business_name') as string)?.trim()
  const businessCategory = form.get('business_category') as string
  const addressText     = (form.get('address_text') as string)?.trim()
  const city            = (form.get('city') as string)?.trim() || null
  const neighborhood    = (form.get('neighborhood') as string)?.trim() || null
  const ifu             = (form.get('ifu') as string)?.trim()
  const rccm            = (form.get('rccm') as string)?.trim() || null
  const lat             = parseFloat(form.get('lat') as string)
  const lng             = parseFloat(form.get('lng') as string)

  if (!businessName || !businessCategory || !addressText || !ifu) {
    return NextResponse.json({ error: 'Champs obligatoires manquants (nom, catégorie, adresse, IFU)' }, { status: 400 })
  }

  // Statut KYC existant
  const { data: kycData } = await svc
    .from('kyc_submissions')
    .select('status, front_path, back_path')
    .eq('user_id', uid)
    .maybeSingle()

  const kycApproved = kycData?.status === 'approved'
  let kycFrontPath  = kycData?.front_path ?? null
  let kycBackPath   = kycData?.back_path  ?? null

  // Upload documents KYC si non encore approuvés
  if (!kycApproved) {
    const frontFile = form.get('kyc_front') as File | null
    const backFile  = form.get('kyc_back')  as File | null

    if (!frontFile || frontFile.size === 0 || !backFile || backFile.size === 0) {
      return NextResponse.json({ error: 'Documents CNI (recto/verso) requis' }, { status: 400 })
    }

    kycFrontPath = await uploadFile(svc, frontFile, `${uid}/kyc_front.${frontFile.name.split('.').pop() ?? 'jpg'}`)
    kycBackPath  = await uploadFile(svc, backFile,  `${uid}/kyc_back.${backFile.name.split('.').pop() ?? 'jpg'}`)

    if (!kycFrontPath || !kycBackPath) {
      return NextResponse.json({ error: 'Erreur upload pièce d\'identité' }, { status: 500 })
    }

    await svc.from('kyc_submissions').upsert({
      user_id:       uid,
      document_type: 'cni',
      front_path:    kycFrontPath,
      back_path:     kycBackPath,
      status:        'pending',
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  // Upload document IFU (obligatoire)
  const ifuFile = form.get('ifu_doc') as File | null
  if (!ifuFile || ifuFile.size === 0) {
    return NextResponse.json({ error: 'Document IFU obligatoire' }, { status: 400 })
  }
  const ifuDocPath = await uploadFile(svc, ifuFile, `${uid}/ifu_doc.${ifuFile.name.split('.').pop() ?? 'pdf'}`)
  if (!ifuDocPath) {
    return NextResponse.json({ error: 'Erreur upload document IFU' }, { status: 500 })
  }

  // Upload document RCCM (optionnel)
  const rccmFile    = form.get('rccm_doc') as File | null
  const rccmDocPath = (rccmFile && rccmFile.size > 0)
    ? await uploadFile(svc, rccmFile, `${uid}/rccm_doc.${rccmFile.name.split('.').pop() ?? 'pdf'}`)
    : null

  // Auto-assignation round-robin : agent avec le moins de demandes actives
  const { data: agents } = await svc
    .from('users')
    .select('id')
    .contains('role', ['field_agent'])

  let assignedAgentId: string | null = null
  const now = new Date().toISOString()

  if (agents && agents.length > 0) {
    const agentIds = agents.map(a => a.id)
    const { data: activeCounts } = await svc
      .from('merchant_applications')
      .select('assigned_agent_id')
      .in('assigned_agent_id', agentIds)
      .in('status', ['assigned', 'field_verified', 'pending_admin'])

    const countMap: Record<string, number> = {}
    for (const id of agentIds) countMap[id] = 0
    for (const row of activeCounts ?? []) {
      if (row.assigned_agent_id) countMap[row.assigned_agent_id] = (countMap[row.assigned_agent_id] ?? 0) + 1
    }

    assignedAgentId = agentIds.reduce((min, id) =>
      (countMap[id] ?? 0) < (countMap[min] ?? 0) ? id : min
    )
  }

  const locationValue = (!isNaN(lat) && !isNaN(lng))
    ? `SRID=4326;POINT(${lng} ${lat})`
    : null

  const { data: application, error: appErr } = await svc
    .from('merchant_applications')
    .insert({
      user_id:           uid,
      business_name:     businessName,
      business_category: businessCategory,
      address_text:      addressText,
      city,
      neighborhood,
      ifu,
      rccm,
      kyc_front_path:    kycFrontPath,
      kyc_back_path:     kycBackPath,
      ifu_doc_path:      ifuDocPath,
      rccm_doc_path:     rccmDocPath,
      location:          locationValue,
      status:            assignedAgentId ? 'assigned' : 'pending_review',
      assigned_agent_id: assignedAgentId,
      assigned_at:       assignedAgentId ? now : null,
    })
    .select('id')
    .single()

  if (appErr || !application) {
    return NextResponse.json({ error: appErr?.message ?? 'Erreur lors de la soumission' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, applicationId: application.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const [{ data: application }, { data: kyc }, { data: merchant }] = await Promise.all([
    svc
      .from('merchant_applications')
      .select('id, status, business_name, assigned_agent_id, created_at, visit_done_at, reviewed_at, rejection_reason')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from('kyc_submissions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle(),
    svc
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    application,
    kycApproved:   kyc?.status === 'approved',
    alreadyMerchant: !!merchant,
  })
}
