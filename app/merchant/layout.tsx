import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MerchantBottomNav from '@/components/merchant/MerchantBottomNav'
import GlobalVoiceNav from '@/components/consumer/GlobalVoiceNav'
import ChatWidget from '@/components/ChatWidget'
import Logo from '@/components/Logo'
import LangToggle from '@/components/ui/LangToggle'
import { getServerT } from '@/lib/i18n/server'

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ t }, h] = await Promise.all([getServerT(), headers()])
  const pathname = h.get('x-pathname') ?? ''
  const isActivatePage = pathname === '/merchant/activate'

  // La page d'activation est accessible à tout utilisateur connecté (même sans rôle merchant)
  // Elle gère elle-même la condition "premier achat requis"
  if (isActivatePage) return <>{children}</>

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isMerchant = profile?.role?.includes('merchant')
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')

  if (!isMerchant && !isAdmin) redirect('/dashboard')

  // Charger le tier actif pour l'afficher dans le top bar
  const { data: merchant } = await supabase
    .from('merchants')
    .select('subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .maybeSingle()

  const isHub = merchant?.is_platform_hub ?? false
  const tier = merchant?.subscription_tier ?? 'free'
  const expires = merchant?.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  const isProActive = isHub || (tier !== 'free' && expires !== null && expires > new Date())
  const isVipActive = isHub || (tier === 'vip' && isProActive)

  const tierLabel = isHub ? '🏢 Hub' : isVipActive ? '👑 VIP' : isProActive ? '🚀 Pro' : '🆓 Free'
  const tierColor = isHub
    ? 'bg-green-100 text-green-700 border-green-200'
    : isVipActive
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : isProActive
        ? 'bg-brand-100 text-brand-700 border-brand-200'
        : 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden" style={{ background: '#fffcf5' }}>
      {/* Top bar — grille 3 colonnes pour éviter tout chevauchement */}
      <div className="px-3 h-14 grid grid-cols-3 items-center" style={{ background: '#fff', borderBottom: '1px solid #f5e6c8' }}>
        {/* Gauche */}
        <Link href="/dashboard" className="text-brand-600 font-medium text-sm truncate min-w-0">
          {t('merchant.topBar.backHome')}
        </Link>
        {/* Centre */}
        <div className="flex justify-center">
          <Logo size={40} className="w-10 h-10" />
        </div>
        {/* Droite */}
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <LangToggle className="text-gray-400 shrink-0" />
          <Link
            href="/merchant/upgrade"
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${tierColor} transition-opacity hover:opacity-80`}
          >
            {tierLabel}
          </Link>
          {isAdmin && (
            <Link
              href="/admin/verify"
              title={t('merchant.topBar.adminLink')}
              className="text-sm bg-gray-900 text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors shrink-0"
            >
              🛡️
            </Link>
          )}
        </div>
      </div>
      {children}
      <MerchantBottomNav />
      <GlobalVoiceNav />
      <ChatWidget />
    </div>
  )
}
