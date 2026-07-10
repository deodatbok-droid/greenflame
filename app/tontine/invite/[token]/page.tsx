import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import Logo from '@/components/Logo'
import { getServerT } from '@/lib/i18n/server'
import Link from 'next/link'
import ValidateInviteButton from './ValidateInviteButton'

interface Props { params: Promise<{ token: string }> }

type Frequency = 'hebdomadaire' | 'bimensuel' | 'mensuel'

export async function generateMetadata({ params }: Props) {
  const { token } = await params
  const { t } = await getServerT()
  const svc = createServiceClient()
  const { data } = await svc.from('tontine_membres').select('id').eq('invite_token', token).single()
  if (!data) return { title: t('tontineInvite.notFound') }
  return {
    title: `${t('tontineInvite.metaTitle')} — GreenFlame`,
    description: t('tontineInvite.metaDesc'),
  }
}

export default async function TontineInvitePage({ params }: Props) {
  const { token } = await params
  const { t } = await getServerT()
  const svc = createServiceClient()

  const { data: membre } = await svc
    .from('tontine_membres')
    .select(`
      id, full_name, status, invite_expires_at,
      tontines ( id, name, contribution_amount_fcfa, frequency, creator_id )
    `)
    .eq('invite_token', token)
    .single()

  // Token jamais émis pour ce membre, ou déjà consommé (validation passée) sans
  // que le membre ait été retrouvé par token — dans ce cas on ne peut pas
  // distinguer "lien jamais valide" de "déjà validé", donc 404 générique.
  if (!membre) notFound()

  const tontine = Array.isArray(membre.tontines) ? membre.tontines[0] : membre.tontines
  if (!tontine) notFound()

  const { data: creatorProfile } = await svc
    .from('users')
    .select('full_name')
    .eq('id', tontine.creator_id)
    .single()

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  const expired = membre.status === 'expired' ||
    (membre.invite_expires_at ? new Date(membre.invite_expires_at) < new Date() : false)
  const alreadyValidated = membre.status === 'active'

  const FREQUENCY_LABELS: Record<Frequency, string> = {
    hebdomadaire: t('tontineInvite.freqHebdo'),
    bimensuel:    t('tontineInvite.freqBimensuel'),
    mensuel:      t('tontineInvite.freqMensuel'),
  }
  const frequency = tontine.frequency as Frequency
  const nextPath = `/tontine/invite/${token}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-5">

        <div className="flex items-center justify-center gap-2">
          <Logo size={40} className="w-10 h-10" />
          <span className="font-semibold text-brand-700">GreenFlame</span>
        </div>

        <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-6 text-white text-center">
          <span className="text-4xl">🤝</span>
          <h1 className="font-bold text-xl mt-2">{t('tontineInvite.title')}</h1>
          <p className="text-brand-100 text-sm mt-2">
            {t('tontineInvite.addedBy').replace('{creator}', creatorProfile?.full_name ?? 'Un membre GreenFlame')}{' '}
            « {tontine.name} »
          </p>
          <p className="text-brand-200 text-xs mt-1">
            {t('tontineInvite.details')
              .replace('{amount}', formatFcfa(tontine.contribution_amount_fcfa))
              .replace('{frequency}', FREQUENCY_LABELS[frequency] ?? frequency)}
          </p>
        </div>

        {alreadyValidated ? (
          <div className="card text-center space-y-3">
            <p className="font-semibold text-gray-900">{t('tontineInvite.alreadyValidatedTitle')}</p>
            <p className="text-sm text-gray-500">{t('tontineInvite.alreadyValidatedBody')}</p>
            <Link href="/tontine" className="btn-primary inline-block">{t('tontineInvite.goToTontine')}</Link>
          </div>
        ) : expired ? (
          <div className="card bg-amber-50 border-amber-200 text-center space-y-2">
            <p className="font-semibold text-amber-800">{t('tontineInvite.expiredTitle')}</p>
            <p className="text-sm text-amber-700">{t('tontineInvite.expiredBody')}</p>
          </div>
        ) : user ? (
          <ValidateInviteButton
            token={token}
            labels={{
              validateCta: t('tontineInvite.validateCta'),
              validating: t('tontineInvite.validating'),
              validateSuccess: t('tontineInvite.validateSuccess'),
              validateError: t('tontineInvite.validateError'),
            }}
          />
        ) : (
          <div className="card text-center space-y-3">
            <p className="text-sm text-gray-600">{t('tontineInvite.needAccountNotice')}</p>
            <div className="flex gap-2">
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="btn-secondary flex-1 text-center"
              >
                {t('tontineInvite.loginCta')}
              </Link>
              <Link
                href={`/register?next=${encodeURIComponent(nextPath)}`}
                className="btn-primary flex-1 text-center"
              >
                {t('tontineInvite.registerCta')}
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
