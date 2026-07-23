import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const canView = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline', 'field_agent'].includes(r))
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const filePath = path.join('/')
  const { data, error } = await svc.storage
    .from('merchant-documents')
    .createSignedUrl(filePath, 300) // 5 minutes

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
