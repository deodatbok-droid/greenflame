import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendKycNotificationEmail } from '@/lib/email'
import { analyzeAndUpdateKyc } from '@/lib/ai/kyc-analyzer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { frontPath, backPath, documentType = 'cni' } = await req.json()
  if (!frontPath) return NextResponse.json({ error: 'Photo recto requise' }, { status: 400 })

  const service = createServiceClient()

  // Upsert : un seul enregistrement KYC par utilisateur
  // Réinitialise les champs IA si re-soumission
  const { data: upserted, error } = await service.from('kyc_submissions').upsert({
    user_id:          user.id,
    document_type:    documentType,
    front_path:       frontPath,
    back_path:        backPath ?? null,
    status:           'pending',
    rejection_reason: null,
    reviewed_by:      null,
    reviewed_at:      null,
    // Réinitialiser les champs IA → nouvelle analyse
    ai_pre_decision:   null,
    ai_confidence:     null,
    ai_extracted_name: null,
    ai_notes:          null,
    ai_analyzed_at:    null,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'user_id' }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification admin (non-bloquant)
  const { data: userProfile } = await service.from('users').select('full_name').eq('id', user.id).single()
  sendKycNotificationEmail(userProfile?.full_name ?? 'Inconnu', user.id).catch(() => {})

  // ── Analyse IA en arrière-plan (non-bloquant) ────────────────────────────
  // Claude Vision pré-décide → l'admin voit le résultat à sa prochaine visite.
  // Si ANTHROPIC_API_KEY n'est pas configuré, l'analyseur retourne needs_review silencieusement.
  if (upserted?.id && process.env.ANTHROPIC_API_KEY) {
    analyzeAndUpdateKyc(upserted.id, frontPath, backPath ?? null, documentType).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
