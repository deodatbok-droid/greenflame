import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import SignOutButton from '@/components/consumer/SignOutButton'
import CopyReferralButton from '@/components/consumer/CopyReferralButton'
import ProfileSettings from '@/components/consumer/ProfileSettings'
import AvatarUpload from '@/components/consumer/AvatarUpload'
import BackButton from '@/components/ui/BackButton'
import FlammeWidget from '@/components/consumer/FlammeWidget'
import CareerPlanWidget from '@/components/consumer/CareerPlanWidget'
import { getServerT } from '@/lib/i18n/server'
import PageTracker from '@/components/ui/PageTracker'
import ProfileNameEdit from '@/components/consumer/ProfileNameEdit'
import { CAREER_RANKS } from '@/lib/career/engine'

const BADGE_COLORS = ['bg-amber-100 text-amber-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700']

function computeNiveau(totalEarned: number, txCount: number): number {
  if (txCount === 0) return 1
  if (totalEarned < 10_000) return 2
  if (totalEarned < 50_000) return 3
  if (totalEarned < 200_000) return 4
  return 5
}

function memberSince(iso: string, locale: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase()
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, locale } = await getServerT()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [profileRes, walletRes, txCountRes, referralCountRes, careerRankRes] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, referral_code, role, kyc_level, created_at, phone, email, transaction_pin, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('wallets')
      .select('total_earned_fcfa, balance_fcfa, balance_gfp')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .eq('status', 'completed'),
    // Compter les affiliés directs depuis network_tree (L1)
    supabase
      .from('network_tree')
      .select('user_id', { count: 'exact', head: true })
      .eq('l1_upline', user.id),
    supabase
      .from('leader_career_ranks')
      .select('current_rank')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const profile        = profileRes.data
  const wallet         = walletRes.data
  const txCount        = txCountRes.count ?? 0
  const referralCount  = referralCountRes.count ?? 0
  const totalEarned    = wallet?.total_earned_fcfa ?? 0
  const niveau         = computeNiveau(totalEarned, txCount)
  const careerRank     = careerRankRes.data?.current_rank ?? 0
  const careerRankInfo = CAREER_RANKS.find(r => r.rank === careerRank)

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
  const referralUrl = `${appUrl}/register?ref=${profile?.referral_code}`

  const isMerchant = profile?.role?.includes('merchant')
  const isAdmin    = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')

  const badges = [
    { label: t('profile.badgeFirstPurchase'),       icon: '🛍️', earned: txCount >= 1 },
    { label: `${referralCount} ${t('profile.badgeReferralsSuffix')}`, icon: '👥', earned: referralCount >= 3 },
    { label: t('profile.badge50k'),  icon: '💰', earned: totalEarned >= 50_000 },
    { label: t('profile.badgeCommunity'),   icon: '🌐', earned: referralCount >= 1 },
  ]

  const kycLabel = (() => {
    const k = profile?.kyc_level
    if (!k || k === 0) return { text: t('profile.kycNoneLabel'), color: 'text-gray-400', icon: '⚪' }
    if (k === 1)        return { text: t('profile.kycLevel1'), color: 'text-green-600', icon: '✅' }
    return                     { text: `${t('profile.kycLevelN')} ${k} ${t('profile.kycBceao')}`, color: 'text-green-700', icon: '🛡️' }
  })()

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <PageTracker event="profile_viewed" />
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 pt-10 pb-8">
        <div className="flex items-center justify-between mb-5">
          <BackButton href="/dashboard" className="text-brand-200 hover:text-white" />
          <span className="text-white/80 text-sm font-semibold">{t('profile.title')}</span>
          <SignOutButton />
        </div>

        {/* Carte identité */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar cliquable — survol pour changer la photo */}
            <AvatarUpload
              currentUrl={profile?.avatar_url ?? null}
              initials={initials(profile?.full_name ?? 'GF')}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <ProfileNameEdit initialName={profile?.full_name ?? ''} />
              <p className="text-brand-200 text-xs mt-0.5 truncate">
                {t('profile.memberSince')} {profile?.created_at ? memberSince(profile.created_at, locale) : '—'}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1.5">
                {/* Rang Flamme */}
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 rounded-full px-2 py-0.5 whitespace-nowrap">
                  ★ {t('dashboard.level')} {niveau} / 5
                </span>
                {/* Rang Carrière Leader */}
                {careerRankInfo && careerRank > 0 && (
                  <span
                    className="text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap"
                    style={{ backgroundColor: `${careerRankInfo.color}33`, color: careerRankInfo.color, border: `1px solid ${careerRankInfo.color}55` }}
                  >
                    {careerRankInfo.name}
                  </span>
                )}
                {isMerchant && (
                  <span className="text-[10px] font-bold bg-brand-500 text-white rounded-full px-2 py-0.5 whitespace-nowrap">
                    {t('profile.merchantBadge')}
                  </span>
                )}
                {isAdmin && (
                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5 whitespace-nowrap">
                    {t('profile.adminBadge')}
                  </span>
                )}
              </div>
              {/* Badges dans le header */}
              <div className="flex flex-wrap gap-1 mt-2">
                {badges.filter(b => b.earned).map(badge => (
                  <span key={badge.label} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 text-white/90 rounded-full px-2 py-0.5">
                    {badge.icon} {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Code parrainage */}
          {txCount === 0 && !isAdmin ? (
            <div className="bg-black/20 rounded-xl p-3">
              <p className="text-brand-300 text-[10px] font-semibold uppercase tracking-wide mb-1">
                {t('profile.referralCode')}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="text-white text-sm font-semibold">{t('profile.referralLocked')}</p>
                  <p className="text-brand-300 text-xs mt-0.5">
                    {t('profile.referralLockedHint')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl p-3 space-y-2">
              <p className="text-brand-300 text-[10px] font-semibold uppercase tracking-wide">
                {t('profile.referralCode')}
              </p>
              <p className="text-white font-bold text-2xl font-mono tracking-widest">
                {profile?.referral_code ?? '—'}
              </p>
              <CopyReferralButton referralUrl={referralUrl} code={profile?.referral_code ?? ''} />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{txCount}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{t('profile.purchases')}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm font-bold text-brand-600 truncate">{formatFcfa(totalEarned)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{t('profile.fcfaEarned')}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-indigo-600">{referralCount}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{t('profile.referrals')}</p>
          </div>
        </div>

        {/* Flamme + Rang */}
        <FlammeWidget />

        {/* Plan de Carrière Leader */}
        <CareerPlanWidget />

        {/* Droits UCP */}
        <Link href="/ucp" className="card flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Ubuntu Capital Plan</p>
              <p className="text-xs text-gray-500">Vos bulletins de souscription UCP</p>
            </div>
          </div>
          <span className="text-gray-400 text-sm">→</span>
        </Link>

        {/* Récompenses */}
        <div className="card">
          <p className="font-semibold text-gray-900 mb-3">{t('profile.rewards')}</p>
          <div className="grid grid-cols-2 gap-2">
            {badges.map((badge, i) => (
              <div
                key={badge.label}
                className={`rounded-xl p-3 flex items-center gap-2 ${
                  badge.earned
                    ? BADGE_COLORS[i % BADGE_COLORS.length]
                    : 'bg-gray-50 text-gray-400 opacity-60'
                }`}
              >
                <span className="text-xl">{badge.icon}</span>
                <p className="text-xs font-semibold leading-tight">{badge.label}</p>
                {badge.earned && <span className="ml-auto text-xs">✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* KYC */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{kycLabel.icon}</span>
            <div>
              <p className={`font-medium text-sm ${kycLabel.color}`}>{kycLabel.text}</p>
              {profile?.phone && (
                <p className="text-xs text-gray-400">{profile.phone}</p>
              )}
            </div>
          </div>
          {(!profile?.kyc_level || profile.kyc_level === 0) && (
            <Link href="/kyc" className="text-xs text-brand-600 font-semibold bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors">
              {t('profile.verifyLink')}
            </Link>
          )}
        </div>

        {/* Paramètres + Support */}
        <ProfileSettings hasPinSet={!!profile?.transaction_pin} isMerchant={isMerchant} />
      </div>
    </div>
  )
}
