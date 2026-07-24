import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { formatFcfa } from '@/lib/utils/format'

const TYPE_LABEL: Record<string, string> = { facture: 'Facture', devis: 'Devis' }

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  emis:      { label: 'Émis',    color: 'bg-green-100 text-green-700' },
  paye:      { label: 'Payé',    color: 'bg-blue-100 text-blue-700'   },
  accepte:   { label: 'Accepté', color: 'bg-green-100 text-green-700' },
  brouillon: { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700' },
  annule:    { label: 'Annulé',  color: 'bg-red-100 text-red-700'     },
  refuse:    { label: 'Refusé',  color: 'bg-red-100 text-red-700'     },
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-400 text-sm flex-shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

export default async function VerifierPage({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const normRef = ref.toUpperCase()

  const svc = createServiceClient()
  const { data: doc } = await svc
    .from('commercial_documents')
    .select('type, status, issue_date, total_fcfa, platform_ref, merchants(business_name)')
    .eq('platform_ref', normRef)
    .maybeSingle()

  // ── Document non trouvé ────────────────────────────────────────────
  if (!doc) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">❌</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Référence introuvable</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              La référence{' '}
              <span className="font-mono font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                {normRef}
              </span>{' '}
              ne correspond à aucun document GreenFlame.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Vérifiez la référence ou contactez l'émetteur du document.
          </p>
          <Link
            href="/"
            className="block text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </main>
    )
  }

  // ── Document trouvé ────────────────────────────────────────────────
  const merchant    = doc.merchants as unknown as { business_name: string } | null
  const statusCfg   = STATUS_CFG[doc.status] ?? { label: doc.status, color: 'bg-gray-100 text-gray-700' }
  const typeLabel   = TYPE_LABEL[doc.type] ?? doc.type
  const issueDate   = new Date(doc.issue_date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-12">
      <div className="max-w-sm w-full space-y-5">

        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size={32} className="w-8 h-8" />
            <span className="font-bold text-gray-900 text-lg">GreenFlame</span>
          </Link>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mt-1">
            Vérification de document
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Bandeau authentique */}
          <div className="bg-brand-600 px-5 py-4 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">✅</span>
            <div>
              <p className="text-white font-bold text-sm">Document authentique</p>
              <p className="text-brand-200 text-xs mt-0.5">
                Émis via la plateforme GreenFlame
              </p>
            </div>
          </div>

          {/* Détails */}
          <div className="px-5 py-5 space-y-4">

            {/* Type + statut */}
            <div className="flex items-center justify-between">
              <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                {typeLabel}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            {/* Infos */}
            <div className="space-y-3">
              <Row label="Émetteur"       value={merchant?.business_name ?? '—'} />
              <Row label="Date d'émission" value={issueDate} />
              <Row label="Montant total"  value={`${formatFcfa(doc.total_fcfa)} FCFA`} bold />
            </div>

            {/* Référence */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Référence GreenFlame</p>
              <p className="font-mono font-bold text-gray-900 tracking-widest text-sm">
                {doc.platform_ref}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Questions ?{' '}
          <Link href="/" className="text-brand-600 hover:text-brand-700">
            greenflame.app
          </Link>
        </p>

      </div>
    </main>
  )
}
