import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndSaveDigest } from '@/lib/ai/admin-digest'

// POST /api/admin/trigger-digest — génération manuelle depuis le dashboard admin
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const digestId = await generateAndSaveDigest('manual')
    return NextResponse.json({ ok: true, digestId })
  } catch (err) {
    console.error('[trigger-digest] Erreur :', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 },
    )
  }
}
