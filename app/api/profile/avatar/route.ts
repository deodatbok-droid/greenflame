import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_SIZE = 5 * 1024 * 1024  // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('avatar') as File | null

  if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format invalide. JPG, PNG ou WebP uniquement.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 5 MB)' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const svc = createServiceClient()

  // Upload dans le bucket Supabase Storage
  const { error: uploadError } = await svc.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,  // remplace si existant
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Récupérer l'URL publique
  const { data: { publicUrl } } = svc.storage.from('avatars').getPublicUrl(path)

  // Mettre à jour le profil utilisateur
  const { error: updateError } = await svc
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, avatarUrl: publicUrl })
}
