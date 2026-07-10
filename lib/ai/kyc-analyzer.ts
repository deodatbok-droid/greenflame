/**
 * lib/ai/kyc-analyzer.ts
 *
 * Analyseur KYC par Claude Vision.
 * Pré-décide avant l'admin humain → réduit la charge de révision de ~80%.
 *
 * Flux :
 *   1. Récupère les URLs signées depuis Supabase Storage
 *   2. Télécharge les images → base64
 *   3. Envoie à Claude Opus Vision avec un prompt structuré
 *   4. Parse la réponse JSON et met à jour kyc_submissions
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────

export type KycPreDecision = 'auto_approve' | 'needs_review' | 'auto_reject'

export interface KycAnalysisResult {
  preDecision: KycPreDecision
  confidence: number         // 0.000 – 1.000
  extractedName: string | null
  notes: string
}

// ── Utilitaire image ───────────────────────────────────────────────────────

async function fetchAsBase64(url: string): Promise<{
  data:      string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}> {
  const res    = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  const buffer = await res.arrayBuffer()
  const ct     = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
  const mediaType = allowed.find(t => t === ct) ?? 'image/jpeg'

  return { data: Buffer.from(buffer).toString('base64'), mediaType }
}

// ── Analyseur principal ────────────────────────────────────────────────────

/**
 * Analyse un ou deux scans de pièce d'identité et retourne une pré-décision.
 * En cas d'erreur IA, retourne `needs_review` pour qu'un humain prenne le relais.
 */
export async function analyzeKycDocument(
  frontSignedUrl: string,
  backSignedUrl?:  string | null,
  documentType:    string = 'cni',
): Promise<KycAnalysisResult> {

  try {
    const client = new Anthropic()   // lit ANTHROPIC_API_KEY automatiquement

    // Télécharger les images
    const frontImg = await fetchAsBase64(frontSignedUrl)
    const imageBlocks: Anthropic.ImageBlockParam[] = [{
      type:   'image',
      source: { type: 'base64', media_type: frontImg.mediaType, data: frontImg.data },
    }]

    if (backSignedUrl) {
      const backImg = await fetchAsBase64(backSignedUrl)
      imageBlocks.push({
        type:   'image',
        source: { type: 'base64', media_type: backImg.mediaType, data: backImg.data },
      })
    }

    const docLabel =
      documentType === 'cni'      ? "Carte Nationale d'Identité (CNI)" :
      documentType === 'passport' ? 'Passeport'                         :
                                    "Document d'identité"

    const sides = imageBlocks.length === 2 ? 'recto et verso' : 'recto uniquement'

    const prompt = `Tu es l'analyseur KYC de GreenFlame, une fintech opérant au Bénin et en Afrique de l'Ouest.

Document soumis : ${docLabel} — ${sides}

Analyse la/les image(s) ci-dessus et réponds UNIQUEMENT avec un objet JSON valide :

{
  "preDecision": "auto_approve" | "needs_review" | "auto_reject",
  "confidence":  0.00,
  "extractedName": "NOM Prénom" | null,
  "notes": "Explication courte en français (max 80 mots)"
}

Règles de décision :
• "auto_approve"  — confiance ≥ 0.85 : document authentique, lisible, non expiré, nom et photo visibles, cohérence recto/verso si fourni
• "auto_reject"   — confiance ≥ 0.85 : faux document apparent, document clairement expiré, mauvais type de document, image illisible/trop sombre/coupée
• "needs_review"  — tout doute, flou modéré, cas ambigus, documents partiellement visibles

Documents valides au Bénin : CNI verte (avant 2020) et bleue/moderne, passeports CEDEAO.
Ne sanctionne pas un document béninois parce qu'il est différent d'un document européen.
Sois strict sur la qualité d'image mais juste sur l'authenticité.`

    const response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 512,
      messages:   [{
        role:    'user',
        content: [...imageBlocks, { type: 'text', text: prompt }],
      }],
    })

    const text      = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON dans la réponse Claude')

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const VALID_DECISIONS: KycPreDecision[] = ['auto_approve', 'needs_review', 'auto_reject']

    return {
      preDecision:   VALID_DECISIONS.includes(parsed.preDecision as KycPreDecision)
                       ? (parsed.preDecision as KycPreDecision)
                       : 'needs_review',
      confidence:    typeof parsed.confidence === 'number'
                       ? Math.min(1, Math.max(0, parsed.confidence))
                       : 0.5,
      extractedName: typeof parsed.extractedName === 'string' ? parsed.extractedName : null,
      notes:         typeof parsed.notes === 'string' ? parsed.notes.slice(0, 500) : '',
    }

  } catch (err) {
    // Erreur réseau, API ou parsing → humain prend la relève
    console.error('[KYC-AI] Analyse échouée :', err instanceof Error ? err.message : err)
    return {
      preDecision:   'needs_review',
      confidence:    0,
      extractedName: null,
      notes:         'Analyse IA indisponible — vérification manuelle requise.',
    }
  }
}

// ── Fonction haut-niveau (utilisée depuis l'API submit) ───────────────────

/**
 * Récupère les URLs signées, lance l'analyse, et met à jour kyc_submissions.
 * Conçu pour être appelé de manière non-bloquante (fire-and-forget).
 */
export async function analyzeAndUpdateKyc(
  submissionId: string,
  frontPath:    string,
  backPath:     string | null,
  documentType: string,
): Promise<void> {
  const svc = createServiceClient()

  // URLs signées valables 5 minutes (suffisant pour l'analyse)
  const { data: fd } = await svc.storage
    .from('kyc-documents')
    .createSignedUrl(frontPath, 300)

  if (!fd?.signedUrl) {
    console.error('[KYC-AI] URL signée front introuvable pour', submissionId)
    return
  }

  let backUrl: string | null = null
  if (backPath) {
    const { data: bd } = await svc.storage
      .from('kyc-documents')
      .createSignedUrl(backPath, 300)
    backUrl = bd?.signedUrl ?? null
  }

  const result = await analyzeKycDocument(fd.signedUrl, backUrl, documentType)

  const { error } = await svc.from('kyc_submissions').update({
    ai_pre_decision:   result.preDecision,
    ai_confidence:     result.confidence,
    ai_extracted_name: result.extractedName,
    ai_notes:          result.notes,
    ai_analyzed_at:    new Date().toISOString(),
  }).eq('id', submissionId)

  if (error) {
    console.error('[KYC-AI] Échec mise à jour DB :', error.message)
  } else {
    console.log(`[KYC-AI] Soumission ${submissionId} → ${result.preDecision} (${Math.round(result.confidence * 100)}%)`)
  }
}
