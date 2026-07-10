import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import Logo from '@/components/Logo'
import { getServerT } from '@/lib/i18n/server'

export const revalidate = 30

interface Props { params: Promise<{ token: string }> }

type Frequency = 'hebdomadaire' | 'bimensuel' | 'mensuel'
type CotisationStatus = 'paye' | 'partiel' | 'en_retard' | 'en_attente'

function getCurrentPeriode(frequency: Frequency): string {
  const now = new Date()
  if (frequency === 'hebdomadaire') {
    const onejan = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodeLabel(periode: string, locale: string, weekLabel: string): string {
  if (periode.includes('-W')) {
    const [y, w] = periode.split('-W')
    return `${weekLabel} ${parseInt(w, 10)} · ${y}`
  }
  const [y, m] = periode.split('-')
  const date = new Date(parseInt(y), parseInt(m, 10) - 1, 1)
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params
  const { t } = await getServerT()
  const svc = createServiceClient()
  const { data } = await svc.from('tontines').select('name').eq('share_token', token).single()
  if (!data) return { title: t('tontinePublic.notFound') }
  return {
    title: `${data.name} — ${t('tontinePublic.metaTitle')} — GreenFlame`,
    description: `${t('tontinePublic.metaDesc')} "${data.name}" sur GreenFlame.`,
  }
}

export default async function PublicTontinePage({ params }: Props) {
  const { token } = await params
  const { t, locale } = await getServerT()
  const svc = createServiceClient()

  const { data: tontine } = await svc
    .from('tontines')
    .select(`
      id, name, description, contribution_amount_fcfa, frequency, start_date, status, created_at,
      tontine_membres (
        id, full_name, position, has_received_pot,
        tontine_cotisations ( id, periode, amount_fcfa, late_fee_fcfa, status, paid_at )
      )
    `)
    .eq('share_token', token)
    .single()

  if (!tontine) notFound()

  type Cotisation = { id: string; periode: string; amount_fcfa: number; late_fee_fcfa: number; status: CotisationStatus; paid_at: string | null }
  type Membre = { id: string; full_name: string; position: number; has_received_pot: boolean; tontine_cotisations: Cotisation[] }

  const FREQUENCY_LABELS: Record<Frequency, string> = {
    hebdomadaire: t('tontinePublic.freqHebdo'),
    bimensuel:    t('tontinePublic.freqBimensuel'),
    mensuel:      t('tontinePublic.freqMensuel'),
  }

  const COTISATION_STATUS_CONFIG: Record<CotisationStatus, { label: string; icon: string; classes: string }> = {
    paye:       { label: t('tontinePublic.statusPaye'),       icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
    partiel:    { label: t('tontinePublic.statusPartiel'),    icon: '🟡', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    en_retard:  { label: t('tontinePublic.statusEnRetard'),   icon: '🔴', classes: 'bg-red-50 text-red-600 border-red-200' },
    en_attente: { label: t('tontinePublic.statusEnAttente'),  icon: '⏳', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  }

  const membres = ((tontine.tontine_membres ?? []) as unknown as Membre[]).slice().sort((a, b) => a.position - b.position)
  const frequency = tontine.frequency as Frequency
  const periodeNow = getCurrentPeriode(frequency)
  const weekLabel = t('tontinePublic.week')
  const periodeLabel = formatPeriodeLabel(periodeNow, locale, weekLabel)
  const totalCagnotte = tontine.contribution_amount_fcfa * membres.length
  const collecte = membres.reduce((sum, m) => {
    const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
    return c && (c.status === 'paye' || c.status === 'partiel') ? sum + c.amount_fcfa + c.late_fee_fcfa : sum
  }, 0)
  const paidCount = membres.filter(m => {
    const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
    return c && (c.status === 'paye' || c.status === 'partiel')
  }).length
  const prochain = membres.find(m => !m.has_received_pot) ?? null
  const pct = membres.length ? Math.round((paidCount / membres.length) * 100) : 0
  const memberLabel = membres.length > 1 ? t('tontinePublic.members') : t('tontinePublic.member')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-2 pt-2">
          <Logo size={40} className="w-10 h-10" />
          <span className="font-semibold text-brand-700">GreenFlame</span>
          <span className="ml-auto text-xs text-gray-400 px-2 py-1 bg-white rounded-full border border-gray-200">
            {t('tontinePublic.readOnly')}
          </span>
        </div>

        <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-6 text-white">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🤝</span>
            <div>
              <h1 className="font-bold text-xl leading-none">{tontine.name}</h1>
              <p className="text-brand-200 text-sm mt-0.5">
                {formatFcfa(tontine.contribution_amount_fcfa)} FCFA · {FREQUENCY_LABELS[frequency]} · {membres.length} {memberLabel}
              </p>
            </div>
          </div>
          {tontine.description && <p className="text-brand-100 text-sm mt-3">{tontine.description}</p>}
        </div>

        {/* Cagnotte du tour */}
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">{t('tontinePublic.potTitle')} — {periodeLabel}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatFcfa(collecte)}{' '}
            <span className="text-base font-normal text-gray-400">/ {formatFcfa(totalCagnotte)} FCFA</span>
          </p>
          <div className="w-full h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {t('tontinePublic.paidCount')
              .replace('{paid}', String(paidCount))
              .replace('{total}', String(membres.length))
              .replace('{pct}', String(pct))}
          </p>
        </div>

        {/* Prochain bénéficiaire */}
        <div className="card">
          <p className="text-xs text-gray-400 mb-2">{t('tontinePublic.nextPot')}</p>
          {prochain ? (
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0">
                {prochain.position}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{prochain.full_name}</p>
                <p className="text-xs text-gray-400">{t('tontinePublic.notYetReceived')}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('tontinePublic.allReceived')}</p>
          )}
        </div>

        {/* Liste des membres + statut de cotisation du tour en cours */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">{t('tontinePublic.contributions')} — {periodeLabel}</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {membres.map(m => {
              const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
              const cfg = COTISATION_STATUS_CONFIG[c?.status ?? 'en_attente']
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {m.position}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                        {m.has_received_pot && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-brand-200 font-medium flex-shrink-0">
                            {t('tontinePublic.alreadyReceived')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.classes}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card bg-amber-50 border-amber-200 text-center">
          <p className="text-xs text-amber-700">{t('tontinePublic.readOnlyNotice')}</p>
        </div>

        <p className="text-center text-xs text-gray-300 pb-4">{t('tontinePublic.poweredBy')}</p>
      </div>
    </div>
  )
}
