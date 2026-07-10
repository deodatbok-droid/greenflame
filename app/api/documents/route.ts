/**
 * /api/documents — Documents commerciaux persistés (devis & factures)
 * GET  — liste les documents du marchand (filtrable par ?type=devis|facture et ?status=...)
 * POST — crée un document avec ses lignes
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getMerchantId(userId: string): Promise<string | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  const svc = createServiceClient()
  let query = svc
    .from('commercial_documents')
    .select('*, commercial_document_lines(id, description, quantity, unit_price_fcfa, position)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (type === 'devis' || type === 'facture') query = query.eq('type', type)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trie les lignes par position pour un affichage stable
  const documents = (data ?? []).map((doc) => ({
    ...doc,
    commercial_document_lines: (doc.commercial_document_lines ?? [])
      .slice()
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position),
  }))

  return NextResponse.json(documents)
}

type DocLine = { description: string; quantity: number; unit_price_fcfa: number }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    type?: 'devis' | 'facture'
    document_number?: string
    status?: string
    client_name?: string
    client_phone?: string
    issue_date?: string
    valid_until?: string | null
    due_date?: string | null
    notes?: string
    linked_document_id?: string | null
    lines?: DocLine[]
  }

  const {
    type, document_number, status, client_name, client_phone,
    issue_date, valid_until, due_date, notes, linked_document_id, lines,
  } = body

  if (type !== 'devis' && type !== 'facture') {
    return NextResponse.json({ error: 'Type de document invalide (devis ou facture attendu)' }, { status: 400 })
  }
  if (!document_number?.trim()) return NextResponse.json({ error: 'Numéro de document requis' }, { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  if (!lines || lines.length === 0) return NextResponse.json({ error: 'Au moins une ligne est requise' }, { status: 400 })

  const total = lines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unit_price_fcfa || 0), 0)

  const svc = createServiceClient()

  // Vérification limite 5 docs/mois pour le tier gratuit (côté serveur)
  const { data: merchant } = await svc
    .from('merchants')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', merchantId)
    .single()

  const isProActive = merchant?.subscription_tier !== 'free'
    && merchant?.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()

  if (!isProActive) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const { count } = await svc
      .from('commercial_documents')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('created_at', startOfMonth.toISOString())
    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Limite de 5 documents par mois atteinte. Passez en Pro pour continuer.' },
        { status: 403 }
      )
    }
  }

  const { data: doc, error: docErr } = await svc
    .from('commercial_documents')
    .insert({
      merchant_id: merchantId,
      type,
      document_number: document_number.trim(),
      status: status ?? 'brouillon',
      client_name: client_name.trim(),
      client_phone: client_phone?.trim() || null,
      issue_date: issue_date ?? new Date().toISOString().slice(0, 10),
      valid_until: valid_until || null,
      due_date: due_date || null,
      notes: notes?.trim() || null,
      total_fcfa: Math.round(total),
      linked_document_id: linked_document_id || null,
    })
    .select('id')
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: docErr?.message ?? 'Erreur création du document' }, { status: 500 })
  }

  const rows = lines.map((l, idx) => ({
    document_id: doc.id,
    description: l.description?.trim() || '—',
    quantity: l.quantity || 1,
    unit_price_fcfa: l.unit_price_fcfa || 0,
    position: idx,
  }))
  const { error: linesErr } = await svc.from('commercial_document_lines').insert(rows)
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })

  const { data: full, error: fullErr } = await svc
    .from('commercial_documents')
    .select('*, commercial_document_lines(id, description, quantity, unit_price_fcfa, position)')
    .eq('id', doc.id)
    .single()

  if (fullErr || !full) return NextResponse.json({ error: fullErr?.message ?? 'Erreur de récupération' }, { status: 500 })

  return NextResponse.json({
    ...full,
    commercial_document_lines: (full.commercial_document_lines ?? [])
      .slice()
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position),
  }, { status: 201 })
}
