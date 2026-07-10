import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * app/api/messages/search/route.ts
 *
 * Palier 2 — recherche exacte d'un autre utilisateur de la plateforme, pour
 * lui envoyer une invitation à discuter. Contraintes strictes (voir mémoire
 * greenflame-messaging-chatbot-architecture.md) :
 *  - Correspondance EXACTE uniquement (téléphone, code de parrainage ou nom
 *    complet) — jamais de liste partielle ni d'autocomplétion, pour éviter
 *    qu'un fraudeur ne puisse confirmer qu'un numéro connu correspond à un
 *    compte GreenFlame actif.
 *  - Le numéro de téléphone n'est JAMAIS renvoyé dans la réponse.
 *  - Gate achat + KYC sur le DEMANDEUR (palier2 = achat ET kyc_level >= 1),
 *    vérifié ici car la recherche interroge `users` au-delà de RLS
 *    (service_role nécessaire pour lire un autre utilisateur que soi-même).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const { data: profile } = await supabase
    .from('users')
    .select('kyc_level')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.kyc_level ?? 0) < 1) {
    return NextResponse.json({ error: 'Vérification KYC requise' }, { status: 403 })
  }

  const { count: txCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .eq('status', 'completed')

  if (!txCount || txCount < 1) {
    return NextResponse.json({ error: 'Premier achat requis' }, { status: 403 })
  }

  // Entrée restreinte à des caractères sûrs (chiffres, lettres, espace, +)
  // avant toute requête — pas de recherche libre/partielle de toute façon,
  // mais on évite aussi tout caractère qui casserait une requête PostgREST.
  const safe = q.replace(/[^\p{L}\p{N}\s+]/gu, '')
  if (!safe) return NextResponse.json({ results: [] })

  const svc = createServiceClient()
  const normalizedPhone = safe.replace(/\s/g, '')

  const [byPhone, byCode, byName] = await Promise.all([
    svc.from('users').select('id, full_name, avatar_url').eq('phone', normalizedPhone).neq('id', user.id).limit(1),
    svc.from('users').select('id, full_name, avatar_url').eq('referral_code', safe.toUpperCase()).neq('id', user.id).limit(1),
    svc.from('users').select('id, full_name, avatar_url').ilike('full_name', safe).neq('id', user.id).limit(1),
  ])

  const seen = new Set<string>()
  const results: { id: string; full_name: string; avatar_url: string | null }[] = []
  for (const r of [...(byPhone.data ?? []), ...(byCode.data ?? []), ...(byName.data ?? [])]) {
    if (!seen.has(r.id)) {
      seen.add(r.id)
      results.push(r)
    }
  }

  return NextResponse.json({ results })
}
