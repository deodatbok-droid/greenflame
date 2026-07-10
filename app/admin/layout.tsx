import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminMobileMenu from '@/components/admin/AdminMobileMenu'
import GlobalVoiceNav from '@/components/consumer/GlobalVoiceNav'
import Link from 'next/link'
import Logo from '@/components/Logo'
import LangToggle from '@/components/ui/LangToggle'
import { getServerT } from '@/lib/i18n/server'
import { cookies } from 'next/headers'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = await getServerT()

  const NAV_LINKS = [
    { href: '/admin/dashboard',      label: t('admin.nav.dashboard')   },
    { href: '/admin/reconciliation', label: t('admin.nav.float')       },
    { href: '/admin/merchants',      label: t('admin.nav.merchants')   },
    { href: '/admin/users',          label: t('admin.nav.members')     },
    { href: '/admin/transactions',   label: t('admin.nav.transactions')},
    { href: '/admin/withdrawals',    label: t('admin.nav.withdrawals') },
    { href: '/admin/kyc',            label: t('admin.nav.kyc')         },
    { href: '/admin/revenue',        label: t('admin.nav.revenue')      },
    { href: '/admin/marketplace',    label: t('admin.nav.marketplace')  },
    { href: '/admin/rewards-fund',   label: t('admin.nav.rewardsFund')  },
    { href: '/admin/ucp',            label: t('admin.nav.ucpRegistry')  },
    { href: '/admin/leaders',        label: 'Leaders'                   },
    { href: '/admin/tresorerie',     label: 'Trésorerie'                },
    { href: '/admin/delivery',       label: 'Delivery'                  },
    { href: '/admin/matrix',         label: 'Matrice réseau'            },
  ]

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) redirect('/dashboard')

  // Vérifier le cookie PIN admin (sauf sur la page /admin/verify elle-même)
  // Note : le layout est appliqué à toutes les routes sous /admin,
  // y compris /admin/verify — on laisse passer cette route sans cookie.
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('gf_admin_verified')
  const isVerified = adminCookie?.value?.startsWith(user.id)

  // On ne bloque pas /admin/verify (infini loop sinon)
  // Le middleware ou la page elle-même gère ce cas
  // Pour simplifier : si pas de cookie ET pas sur /admin/verify → redirect
  // La vérification du path se fait via headers
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isVerifyPage = pathname.includes('/admin/verify')

  if (!isVerified && !isVerifyPage) {
    redirect('/admin/verify')
  }

  // Page verify = standalone, sans le nav admin qui bloquerait les clics
  if (isVerifyPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden">
      <nav className="bg-gray-800 border-b border-gray-700 px-3 md:px-6 py-3 flex items-center justify-between sticky top-0 z-40 min-w-0">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <Logo size={36} className="w-9 h-9 shrink-0" />
            <span className="font-bold text-sm md:text-lg text-white">
              <span className="hidden sm:inline">{t('admin.title')}</span>
              <span className="sm:hidden">Admin</span>
            </span>
          </div>
          {/* Desktop links */}
          <div className="hidden md:flex gap-4 text-sm flex-wrap">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="text-gray-300 hover:text-white transition-colors whitespace-nowrap">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LangToggle className="text-gray-400" />
          <Link href="/dashboard" className="text-xs text-brand-400 hidden sm:block whitespace-nowrap">{t('admin.backToApp')}</Link>
          {/* Mobile hamburger */}
          <AdminMobileMenu links={NAV_LINKS} userName={profile?.full_name ?? ''} />
        </div>
      </nav>
      <main className="p-3 md:p-6">{children}</main>
      <GlobalVoiceNav />
    </div>
  )
}
