import { createServiceClient } from '@/lib/supabase/server'
import KycActions from './KycActions'
import { requireAdmin } from '@/lib/utils/admin-guard'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

type KycPreDecision = 'auto_approve' | 'needs_review' | 'auto_reject' | null

interface KycSub {
  id:                string
  user_id:           string
  document_type:     string
  front_path:        string | null
  back_path:         string | null
  status:            'pending' | 'approved' | 'rejected'
  rejection_reason:  string | null
  reviewed_at:       string | null
  created_at:        string
  ai_pre_decision:   KycPreDecision
  ai_confidence:     number | null
  ai_extracted_name: string | null
  ai_notes:          string | null
  ai_analyzed_at:    string | null
  users:             { full_name: string; phone: string } | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function AiBadge({ decision, confidence }: { decision: KycPreDecision; confidence: number | null }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
        🤖 Analyse en cours…
      </span>
    )
  }

  const pct = confidence !== null ? ` ${Math.round(confidence * 100)}%` : ''

  if (decision === 'auto_approve') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 font-medium">
        🤖 IA : Approuver{pct}
      </span>
    )
  }
  if (decision === 'auto_reject') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 font-medium">
        🤖 IA : Refuser{pct}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 font-medium">
      🔍 IA : Vérifier{pct}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireAdmin()

  const { filter = 'pending' } = await searchParams

  const service = createServiceClient()

  const { data: submissions } = await service
    .from('kyc_submissions')
    .select(`
      id, user_id, document_type, front_path, back_path,
      status, rejection_reason, reviewed_at, created_at,
      ai_pre_decision, ai_confidence, ai_extracted_name, ai_notes, ai_analyzed_at,
      users(full_name, phone)
    `)
    .order('created_at', { ascending: false })

  const raw = (submissions ?? []) as unknown as KycSub[]

  // Compteurs globaux
  const totalPending  = raw.filter(s => s.status === 'pending').length
  const totalApproved = raw.filter(s => s.status === 'approved').length
  const totalRejected = raw.filter(s => s.status === 'rejected').length

  // Compteurs IA (parmi les en attente)
  const pendingList = raw.filter(s => s.status === 'pending')
  const aiApprove   = pendingList.filter(s => s.ai_pre_decision === 'auto_approve').length
  const aiReview    = pendingList.filter(s => s.ai_pre_decision === 'needs_review' || !s.ai_pre_decision).length
  const aiReject    = pendingList.filter(s => s.ai_pre_decision === 'auto_reject').length

  // Filtrage
  const filtered: KycSub[] = filter === 'all'          ? raw
    : filter === 'approved'    ? raw.filter(s => s.status === 'approved')
    : filter === 'rejected'    ? raw.filter(s => s.status === 'rejected')
    : filter === 'ai_approve'  ? raw.filter(s => s.status === 'pending' && s.ai_pre_decision === 'auto_approve')
    : filter === 'ai_reject'   ? raw.filter(s => s.status === 'pending' && s.ai_pre_decision === 'auto_reject')
    : filter === 'ai_review'   ? raw.filter(s => s.status === 'pending' && (s.ai_pre_decision === 'needs_review' || !s.ai_pre_decision))
    : /* default = pending */    raw.filter(s => s.status === 'pending')

  const tabs = [
    { key: 'ai_review',  label: `🔍 À vérifier`,       count: aiReview,      color: 'text-yellow-400' },
    { key: 'ai_approve', label: `✅ IA approuve`,        count: aiApprove,     color: 'text-emerald-400' },
    { key: 'ai_reject',  label: `❌ IA refuse`,          count: aiReject,      color: 'text-red-400' },
    { key: 'pending',    label: `⏳ En attente`,         count: totalPending,  color: 'text-orange-400' },
    { key: 'approved',   label: `✔ Approuvées`,          count: totalApproved, color: 'text-green-400' },
    { key: 'rejected',   label: `✕ Refusées`,            count: totalRejected, color: 'text-red-400' },
    { key: 'all',        label: `Toutes`,                count: raw.length,    color: 'text-gray-400' },
  ]

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Vérifications KYC</h1>
        <p className="text-gray-400 text-sm mt-1">
          {totalPending} en attente · {totalApproved} approuvées · {totalRejected} refusées
          {totalPending > 0 && (
            <span className="ml-2 text-yellow-400">
              · 🤖 {aiReview} à revoir manuellement
            </span>
          )}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'IA : À vérifier',   count: aiReview,      color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
          { label: 'IA : Auto-approuv', count: aiApprove,     color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
          { label: 'IA : Auto-refusés', count: aiReject,      color: 'text-red-400',    bg: 'bg-red-900/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} bg-gray-800 rounded-xl p-4 text-center border border-gray-700`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-gray-400 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs de filtrage */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/admin/kyc?filter=${t.key}`}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
              filter === t.key
                ? 'bg-white text-gray-900 font-semibold'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {t.label}
            <span className={`text-xs font-bold ${filter === t.key ? 'text-gray-600' : t.color}`}>
              {t.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            Aucune soumission dans cette catégorie
          </div>
        ) : filtered.map(sub => {
          const owner = sub.users
          return (
            <div key={sub.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">

                  {/* En-tête : nom + statut + badge IA */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="font-semibold text-white">{owner?.full_name ?? '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sub.status === 'pending'  ? 'bg-yellow-900/30 text-yellow-400' :
                      sub.status === 'approved' ? 'bg-green-900/30 text-green-400'  :
                                                  'bg-red-900/30 text-red-400'
                    }`}>
                      {sub.status === 'pending' ? 'En attente' :
                       sub.status === 'approved' ? 'Approuvée'  : 'Refusée'}
                    </span>
                    {sub.status === 'pending' && (
                      <AiBadge decision={sub.ai_pre_decision} confidence={sub.ai_confidence} />
                    )}
                  </div>

                  <p className="text-gray-400 text-sm">{owner?.phone}</p>

                  {/* Nom extrait par IA */}
                  {sub.ai_extracted_name && (
                    <p className="text-gray-300 text-sm mt-1">
                      📋 Nom sur document : <span className="font-medium text-white">{sub.ai_extracted_name}</span>
                      {owner?.full_name && sub.ai_extracted_name.toUpperCase() !== owner.full_name.toUpperCase() && (
                        <span className="ml-2 text-yellow-400 text-xs">⚠ Différent du profil</span>
                      )}
                    </p>
                  )}

                  {/* Notes IA */}
                  {sub.ai_notes && (
                    <p className="text-gray-500 text-xs mt-2 italic border-l-2 border-gray-700 pl-2">
                      🤖 {sub.ai_notes}
                    </p>
                  )}

                  <div className="flex gap-4 mt-2">
                    <p className="text-gray-500 text-xs">
                      Soumis le {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    {sub.ai_analyzed_at && (
                      <p className="text-gray-600 text-xs">
                        · IA analysé {new Date(sub.ai_analyzed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {sub.rejection_reason && (
                    <p className="text-red-400 text-xs mt-1">Raison : {sub.rejection_reason}</p>
                  )}
                </div>

                {/* Liens documents */}
                <DocumentLinks
                  frontPath={sub.front_path}
                  backPath={sub.back_path}
                  userId={sub.user_id}
                />
              </div>

              {/* Actions admin (seulement si en attente) */}
              {sub.status === 'pending' && (
                <KycActions
                  submissionId={sub.id}
                  aiPreDecision={sub.ai_pre_decision}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Document links (génère des URLs signées temporaires) ───────────────────

async function DocumentLinks({ frontPath, backPath, userId }: {
  frontPath: string | null; backPath: string | null; userId: string
}) {
  const service = createServiceClient()
  void userId

  const links: { label: string; url: string }[] = []

  if (frontPath) {
    const { data } = await service.storage.from('kyc-documents').createSignedUrl(frontPath, 3600)
    if (data?.signedUrl) links.push({ label: 'Recto', url: data.signedUrl })
  }
  if (backPath) {
    const { data } = await service.storage.from('kyc-documents').createSignedUrl(backPath, 3600)
    if (data?.signedUrl) links.push({ label: 'Verso', url: data.signedUrl })
  }

  if (links.length === 0) return <p className="text-gray-500 text-xs flex-shrink-0">Aucun document</p>

  return (
    <div className="flex gap-2 flex-shrink-0">
      {links.map(l => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-2 rounded-lg transition-colors"
        >
          📄 {l.label}
        </a>
      ))}
    </div>
  )
}
