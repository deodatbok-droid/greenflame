import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin, verifyPin } from '@/lib/utils/pin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { oldPin?: string; newPin: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  const { oldPin, newPin } = body

  if (!newPin || !/^\d{6}$/.test(newPin)) {
    return NextResponse.json({ error: 'Le nouveau PIN doit contenir exactement 6 chiffres' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Récupérer le PIN actuel (service role pour bypass RLS)
  const { data: profile } = await svc
    .from('users')
    .select('transaction_pin')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const hasExistingPin = !!profile.transaction_pin

  // Si un PIN est déjà défini, vérifier l'ancien
  if (hasExistingPin) {
    if (!oldPin) {
      return NextResponse.json({ error: 'Votre ancien code PIN est requis' }, { status: 400 })
    }
    const valid = profile.transaction_pin!.includes(':')
      ? verifyPin(oldPin, profile.transaction_pin!)
      : profile.transaction_pin === oldPin // fallback legacy plaintext
    if (!valid) {
      return NextResponse.json({ error: 'Ancien code PIN incorrect' }, { status: 401 })
    }
  }

  // Enregistrer le nouveau PIN hashé
  const { error } = await svc
    .from('users')
    .update({ transaction_pin: hashPin(newPin) })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: hasExistingPin ? 'PIN modifié avec succès' : 'PIN défini avec succès' })
}
