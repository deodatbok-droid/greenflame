import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerT } from '@/lib/i18n/server'
import { AlertsManager } from '@/components/immobilier/AlertsManager'

const CATEGORY_BG   = '#E1F5EE'
const CATEGORY_ICON = '#0F6E56'

export default async function ImmobilierAlertsPage() {
  const { t, locale } = await getServerT()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/immobilier/alertes')

  return (
    <div className="max-w-4xl mx-auto">
      <div
        className="px-5 pt-12 pb-5 md:pt-8 md:rounded-b-3xl"
        style={{ background: `linear-gradient(135deg, ${CATEGORY_BG}, ${CATEGORY_BG}dd)` }}
      >
        <Link href="/immobilier" className="text-sm mb-4 inline-block" style={{ color: CATEGORY_ICON }}>
          {t('immobilier.alertsBackLink')}
        </Link>
        <h1 className="text-xl font-bold" style={{ color: CATEGORY_ICON }}>{t('immobilier.alertsPageTitle')}</h1>
        <p className="text-sm mt-0.5" style={{ color: `${CATEGORY_ICON}bb` }}>{t('immobilier.alertsPageTagline')}</p>
      </div>

      <div className="px-4 pb-8 mt-5">
        <AlertsManager locale={locale} />
      </div>
    </div>
  )
}
