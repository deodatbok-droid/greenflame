import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_SIZE    = 8 * 1024 * 1024                          // 8 MB
const ALLOWED     = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('banner') as File | null

  if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: 'Format invalide. JPG, PNG ou WebP uniquement.' }, { status: 400 })
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Fichier trop volumineux (max 8 MB)' }, { status: 400 })

  // Vérifier que l'utilisateur est bien un marchand actif
  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const ext    = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path   = `${merchant.id}/banner.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload dans le bucket avatars (réutilise le même bucket, préfixé par merchant id)
  const { error: uploadError } = await svc.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = svc.storage.from('avatars').getPublicUrl(path)

  // Mettre à jour banner_url du marchand
  const { error: updateError } = await svc
    .from('merchants')
    .update({ banner_url: publicUrl })
    .eq('id', merchant.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, bannerUrl: publicUrl })
}
