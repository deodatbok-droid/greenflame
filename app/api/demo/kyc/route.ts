import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_EMAIL } from '@/lib/demo/data'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const svc = createServiceClient()
  const uid = user.id

  const { error } = await svc.from('kyc_submissions').upsert({
    user_id:       uid,
    document_type: 'cni',
    front_path:    'https://placehold.co/600x400/22c55e/white?text=CNI+DEMO+RECTO',
    back_path:     'https://placehold.co/600x400/16a34a/white?text=CNI+DEMO+VERSO',
    status:        'approved',
    reviewed_at:   new Date().toISOString(),
    reviewed_by:   null,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
