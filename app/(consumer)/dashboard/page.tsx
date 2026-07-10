import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import LangToggle from '@/components/ui/LangToggle'
import CopyReferralButton from '@/components/consumer/CopyReferralButton'
import NotificationBell from '@/components/consumer/NotificationBell'
import Logo from '@/components/Logo'
import FormationsTicker, { type MiniFormation } from '@/components/dashboard/FormationsTicker'
import { getServerT } from '@/lib/i18n/server'
import CagnotteWidget from '@/components/consumer/CagnotteWidget'

export default async function ConsumerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t, locale } = await getServerT()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [walletRes, txRes, userRes, commissionsRes, txCountRes, networkCountRes, miniFormationsRes, scoreRes] = await Promise.all([
    supabase.from('wallet_summary').select('*').eq('user_id', user.id).single(),
    supabase
      .from('transactions')
      .select('id, amount_fcfa, created_at, merchants(business_name)')
      .eq('buyer_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('users').select('full_name, referral_code, role, upline_id').eq('id', user.id).single(),
    supabase
      .from('commission_distributions')
      .select('amount_fcfa, distribution_type')
      .eq('recipient_id', user.id)
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .eq('status', 'completed'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('upline_id', user.id),
    supabase
      .from('products')
      .select('id, name, description, price_fcfa, emoji, merchants!inner(is_platform_hub)')
      .eq('is_available', true)
      .eq('merchants.is_platform_hub', true)
      .ilike('name', '%mini-formation%')
      .order('sort_order', { ascending: true })
      .limit(3),
    supabase.from('user_scores').select('score, niveau, bnpl_eligible').eq('user_id', user.id).single(),
  ])

  const wallet          = walletRes.data
  const transactions    = txRes.data ?? []
  const profile         = userRes.data
  if (!profile) redirect('/complete-profile')
  const commissions     = commissionsRes.data ?? []
  const txCount         = txCountRes.count ?? 0
  const networkSize     = networkCountRes.count ?? 0
  const miniFormations: MiniFormation[] = [
    ...((miniFormationsRes.data ?? []) as MiniFormation[]),
    {
      id:          'pack-mystere',
      name:        'Pack Mystère',
      description: 'Boostez vos Flammes et découvrez des surprises exclusives réservées aux membres GreenFlame.',
      price_fcfa:  100,
      emoji:       '🎁',
      href:        '/pack-mystere',
      badge:       '🔥 Pack Mystère',
      ctaLabel:    'Ouvrir un Pack →',
    },
  ]
  const userScore       = scoreRes.data

  const isMerchant  = profile?.role?.includes('merchant')
  const isKingmaker = profile?.role?.includes('kingmaker')
  const isAdmin     = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  const hasNoUpline = !profile?.upline_id
  const isNewUser   = txCount === 0

  const monthlyNetwork  = commissions.filter(c => c.distribution_type === 'network').reduce((s, c) => s + c.amount_fcfa, 0)
  const monthlyCashback = commissions.filter(c => c.distribution_type === 'cashback').reduce((s, c) => s + c.amount_fcfa, 0)
  const monthlyIncome   = monthlyCashback + monthlyNetwork

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
  const referralUrl = `${appUrl}/register?ref=${profile?.referral_code}`
  const dateLocale  = locale === 'en' ? 'en-US' : 'fr-FR'
  const moisLabel   = new Date().toLocaleString(dateLocale, { month: 'long' })

  // Niveau calculé à partir des membres directs de la communauté
  const level      = networkSize >= 20 ? 5 : networkSize >= 10 ? 4 : networkSize >= 5 ? 3 : networkSize >= 1 ? 2 : 1
  const levelLabel = ['', t('dashboard.level1Label'), t('dashboard.level2Label'), t('dashboard.level3Label'), t('dashboard.level4Label'), t('dashboard.level5Label')][level]
  const nextTarget = [1, 5, 10, 20][level - 1] ?? null
  const levelPct   = nextTarget ? Math.min((networkSize / nextTarget) * 100, 100) : 100

  const LIFE_GOALS = [
    { name: t('dashboard.lifeGoal1'), target:  10_000, icon: '🏥' },
    { name: t('dashboard.lifeGoal2'), target:  15_000, icon: '👕' },
    { name: t('dashboard.lifeGoal3'), target:  20_000, icon: '💡' },
    { name: t('dashboard.lifeGoal4'), target:  23_500, icon: '🎲' },
    { name: t('dashboard.lifeGoal5'), target:  30_000, icon: '🚗' },
    { name: t('dashboard.lifeGoal6'), target:  40_000, icon: '📚' },
    { name: t('dashboard.lifeGoal7'), target:  50_000, icon: '🏠' },
    { name: t('dashboard.lifeGoal8'), target:  70_000, icon: '🍚' },
    { name: t('dashboard.lifeGoal9'), target: 258_500, icon: '⭐' },
  ]
  const AVG_INCOME_PER_MEMBER = 200
  const BASE_GOALS_COUNT = LIFE_GOALS.length - 1
  const coveredBaseCount = LIFE_GOALS.slice(0, BASE_GOALS_COUNT).filter(g => monthlyIncome >= g.target).length
  const nextGoal = LIFE_GOALS.find((g, i) => monthlyIncome < g.target && (i === 0 || monthlyIncome >= LIFE_GOALS[i - 1].target)) ?? null

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Logo size={48} className="w-12 h-12" />
            <span className="font-semibold text-brand-700 text-base">GreenFlame</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/verify"
                className="text-xs font-semibold text-brand-700 bg-brand-100 hover:bg-brand-200 px-2 py-1 rounded-lg transition-colors"
              >
                ⚙
              </Link>
            )}
            <NotificationBell />
            <LangToggle className="text-gray-500" />
            <Link href="/profile">
              <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm hover:bg-brand-200 transition-colors flex-shrink-0">
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* ── GREETING + NIVEAU ── */}
        <div>
          <p className="text-gray-500 text-sm mb-0.5">{t('dashboard.hello')}</p>
          <h1 className="text-xl font-bold text-gray-900">{profile?.full_name ?? t('dashboard.member')} 👋</h1>
          <div className="mt-3">
            <div className="flex flex-wrap justify-between gap-x-2 text-xs text-gray-400 mb-1">
              <span className="shrink-0">{t('dashboard.level')} {level} — {levelLabel}</span>
              {nextTarget && (
                <span className="shrink-0">{t('dashboard.level')} {level + 1} : {nextTarget - networkSize} {nextTarget - networkSize > 1 ? t('dashboard.membersRequiredPlural') : t('dashboard.membersRequired')}</span>
              )}
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-flame-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(levelPct, levelPct > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── ACTIVATION — premier achat ── */}
        {isNewUser && !isAdmin && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-flame-500 to-flame-600 text-white relative">
            {/* Photo de fond */}
            <div className="absolute inset-0">
              <img
                src="/images/Activez votre compte.png"
                alt=""
                className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
              />
            </div>
            <div className="relative p-4 flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">🔥</span>
              <div className="flex-1">
                <p className="font-bold text-lg leading-tight">{t('dashboard.activateTitle')}</p>
                <p className="text-flame-100 text-sm mt-1">
                  {t('dashboard.activateDesc')}
                  {hasNoUpline && ` ${t('dashboard.activateNoSponsor')}`}
                </p>
                <Link href="/marketplace">
                  <button className="mt-3 bg-white text-flame-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-flame-50 transition-colors">
                    {t('dashboard.makeFirstPurchase')}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── SCORE GREENFLAME + ACADÉMIE ── */}
        <Link href="/academie">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-green-50 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-green-700 leading-none">{userScore?.score ?? '—'}</span>
              <span className="text-[9px] text-green-500 font-semibold uppercase tracking-wide mt-0.5">/ 1000</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('dashboard.academieScoreLabel')}</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">
                {userScore ? (
                  ({
                    debutant: t('dashboard.academieNiveauDebutant'),
                    actif:    t('dashboard.academieNiveauActif'),
                    fiable:   t('dashboard.academieNiveauFiable'),
                    avance:   t('dashboard.academieNiveauAvance'),
                    expert:   t('dashboard.academieNiveauExpert'),
                  } as Record<string, string>)[userScore.niveau] ?? userScore.niveau
                ) : t('dashboard.academieStartCta')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {userScore?.bnpl_eligible ? t('dashboard.academieBnplEligible') : t('dashboard.academieFree')}
              </p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </Link>

        {/* ── SWAHILI — LANGUE PANAFRICAINE ── */}
        <Link href="/swahili">
          <div className="rounded-2xl border border-green-100 bg-gradient-to-r from-green-950 to-green-900 shadow-sm p-4 flex items-center gap-4 hover:opacity-90 transition-opacity">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-amber-400/20 flex items-center justify-center text-3xl">
              🌍
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">{t('dashboard.swahiliFeatureBadge')}</p>
              <p className="font-bold text-white text-sm mt-0.5">{t('dashboard.swahiliFeatureTitle')}</p>
              <p className="text-xs text-green-300 mt-0.5 italic">&ldquo;Umuntu ngumuntu ngabantu.&rdquo;</p>
            </div>
            <span className="text-amber-400 text-lg">›</span>
          </div>
        </Link>

        {/* ── MINI-FORMATIONS ── */}
        {miniFormations.length > 0 && (
          <FormationsTicker products={miniFormations} />
        )}

        {/* ── PORTEFEUILLE ── */}
        <div className="bg-brand-700 rounded-2xl p-5 text-white">
          <p className="text-brand-200 text-xs mb-1">{t('dashboard.myWallet')}</p>
          <p className="text-3xl font-bold mb-0.5">
            {wallet
              ? formatFcfa(wallet.balance_fcfa + Math.floor((wallet.balance_gfp ?? 0) * GOVERNANCE.GFP_TO_FCFA_RATE))
              : '—'
            } <span className="text-lg font-medium">FCFA</span>
          </p>
          {wallet && (wallet.balance_gfp ?? 0) > 0 && (() => {
            const gfp = wallet.balance_gfp ?? 0
            const fcfaTotal = wallet.balance_fcfa + Math.floor(gfp * GOVERNANCE.GFP_TO_FCFA_RATE)
            const remainder = gfp % 10
            return (
              <p className="text-brand-300 text-xs mb-3">
                {formatFcfa(fcfaTotal)} FCFA{remainder > 0 ? ` + ${remainder} GFP` : ''}
              </p>
            )
          })()}
          <div className="flex gap-2 mt-3">
            <Link href="/wallet" className="flex-1">
              <button className="w-full bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-medium py-2 rounded-lg">
                {t('nav.wallet')} →
              </button>
            </Link>
            <Link href="/pay" className="flex-1">
              <button className="w-full bg-flame-500 hover:bg-flame-600 transition-colors text-white text-xs font-bold py-2 rounded-lg">
                {t('dashboard.payNow')} 🔥
              </button>
            </Link>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/wallet">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-brand-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-brand-700">+{formatFcfa(monthlyCashback)}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{t('dashboard.cashback')}</p>
              <p className="text-xs text-brand-500 mt-1">{moisLabel}</p>
            </div>
          </Link>
          <Link href="/wallet">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-indigo-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-indigo-700">+{formatFcfa(monthlyNetwork)}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{t('dashboard.networkDividend')}</p>
            </div>
          </Link>
          <Link href="/network">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-green-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-green-700">{networkSize}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{t('dashboard.members')}</p>
            </div>
          </Link>
        </div>

        {/* ── BON DE RETRAIT — raccourci ── */}
        {!isNewUser && (
          <Link href="/voucher">
            <div className="bg-white rounded-xl border border-gray-100 hover:border-brand-200 flex items-center gap-3 p-4 cursor-pointer transition-colors group">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                🎟️
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{t('dashboard.voucherTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.voucherDesc')}</p>
              </div>
              <span className="text-indigo-400 text-lg">→</span>
            </div>
          </Link>
        )}

        {/* ── MA TONTINE ── */}
        <Link href="/tontine">
          <div className="bg-white rounded-xl border border-gray-100 hover:border-brand-200 flex items-center gap-3 p-4 cursor-pointer transition-colors group">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-brand-100 transition-colors">
              🤝
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-800">{t('dashboard.tontineTitle')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.tontineDesc')}</p>
            </div>
            <span className="text-brand-400 text-lg">→</span>
          </div>
        </Link>

        {/* ── OUVRIR UNE BOUTIQUE ── */}
        {!isMerchant && (
          <Link href="/merchant/activate">
            <div className="bg-white rounded-xl border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 flex items-center gap-3 p-4 cursor-pointer transition-colors">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-2xl flex-shrink-0">
                🏪
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-brand-700">{t('dashboard.openShopTitle')}</p>
                <p className="text-xs mt-0.5 text-brand-500">
                  {t('dashboard.openShopDesc')}
                </p>
              </div>
              <span className="text-lg text-brand-400">→</span>
            </div>
          </Link>
        )}

        {/* ── ACTIVITÉ RÉCENTE ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-gray-900">{t('dashboard.recentTransactions')}</h2>
            <Link href="/history" className="text-xs text-brand-600 font-medium">{t('common.viewAll')} →</Link>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 text-center py-8">
              <p className="text-3xl mb-2">🛍️</p>
              <p className="font-medium text-gray-600">{t('dashboard.noTransactions')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {transactions.map(tx => {
                const merchant = tx.merchants as unknown as { business_name: string } | null
                return (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-50 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                        🛍️
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 font-medium">
                          {merchant?.business_name ?? 'Marchand'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString(dateLocale, {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatFcfa(tx.amount_fcfa)} F
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── DIVIDENDES COMMUNAUTAIRES — explication ── */}
        {monthlyNetwork > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700 space-y-1">
            <p className="font-semibold">{t('dashboard.dividendTitle')}</p>
            <p>
              {t('dashboard.dividendExplain')}
              {' '}<strong>{t('dashboard.dividendSince').replace('{month}', moisLabel)}</strong>.
            </p>
          </div>
        )}

        {/* ── OBJECTIFS DE VIE ── */}
        <Link href="/network">
          <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-brand-200 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{t('dashboard.lifeGoals')}</h2>
              <span className="text-xs text-gray-400">
                {coveredBaseCount > 0
                  ? t('dashboard.lifeGoalCoveredCount').replace('{covered}', String(coveredBaseCount)).replace('{total}', String(BASE_GOALS_COUNT))
                  : t('dashboard.lifeGoalTiers').replace('{n}', String(LIFE_GOALS.length))}
              </span>
            </div>
            <div className="space-y-4">
              {LIFE_GOALS.map((goal, i) => {
                const pct       = Math.min((monthlyIncome / goal.target) * 100, 100)
                const isDone    = monthlyIncome >= goal.target
                const isNext    = !isDone && (i === 0 || monthlyIncome >= LIFE_GOALS[i - 1].target)
                const remaining = Math.max(goal.target - monthlyIncome, 0)
                const membersNeeded = Math.ceil(goal.target / AVG_INCOME_PER_MEMBER)

                return (
                  <div key={goal.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{goal.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                        {isNext && !isDone && (
                          <span className="text-[10px] font-bold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 ml-1">{t('dashboard.lifeGoalInProgress')}</span>
                        )}
                        {isDone && (
                          <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-2 py-0.5 ml-1">✓</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatFcfa(goal.target)}{t('dashboard.lifeGoalPerMonth')}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-flame-500 transition-all duration-500"
                        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    {!isDone && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {t('dashboard.lifeGoalRemaining').replace('{amount}', formatFcfa(remaining)).replace('{n}', membersNeeded.toLocaleString())}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {monthlyIncome > 0 && nextGoal && (
              <p className="text-xs text-brand-600 text-center mt-3 pt-3 border-t border-gray-100">
                💡 {t('dashboard.lifeGoalNudge').replace('{goal}', nextGoal.name)}
              </p>
            )}
            {monthlyIncome === 0 && (
              <p className="text-xs text-gray-400 text-center mt-3 pt-3 border-t border-gray-100">
                {t('dashboard.lifeGoalFirstPurchase')}
              </p>
            )}
          </div>
        </Link>

        {/* ── CAGNOTTE COMMUNAUTAIRE ── */}
        <CagnotteWidget />

        {/* ── LIEN DE PARRAINAGE ── */}
        {isNewUser && !isAdmin ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                🔒
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500">{t('dashboard.referralLocked')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('dashboard.referralLockedDesc')}
                </p>
              </div>
            </div>
            <Link href="/marketplace">
              <button className="mt-3 w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                {t('dashboard.makeFirstPurchase')}
              </button>
            </Link>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-brand-50 to-fuchsia-50 border border-brand-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium">{t('dashboard.referralLink')}</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-bold font-mono text-brand-700">{profile?.referral_code}</p>
              <CopyReferralButton referralUrl={referralUrl} code={profile?.referral_code ?? ''} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t('dashboard.referralExplain')}
            </p>
          </div>
        )}

        {/* ── DÉMO ── */}
        <Link href="/demo">
          <div className="bg-gradient-to-r from-brand-700 to-brand-800 rounded-xl p-4 flex items-center gap-3 hover:from-brand-800 hover:to-brand-900 transition-colors cursor-pointer">
            <span className="text-2xl flex-shrink-0">⚡</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{t('dashboard.demoTitle')}</p>
              <p className="text-xs text-brand-200 mt-0.5">{t('dashboard.demoDesc')}</p>
            </div>
            <span className="text-brand-300 text-lg">→</span>
          </div>
        </Link>

        {/* ── RACCOURCIS PAR RÔLE ── */}
        {(isMerchant || isKingmaker || isAdmin) && (
          <div className="flex gap-3">
            {isMerchant && (
              <Link href="/merchant/dashboard" className="flex-1">
                <div className="bg-white rounded-xl border border-gray-100 text-center py-3 hover:border-brand-200 transition-colors cursor-pointer">
                  <span className="text-2xl">🏪</span>
                  <p className="text-xs font-medium text-gray-700 mt-1">{t('dashboard.merchantSpace')}</p>
                </div>
              </Link>
            )}
            {isKingmaker && (
              <Link href="/network" className="flex-1">
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/verify" className="flex-1">
                <div className="bg-gray-900 rounded-xl border border-gray-700 text-center py-3 hover:border-brand-500 transition-colors cursor-pointer">
                  <span className="text-2xl">🛡️</span>
                  <p className="text-xs font-medium text-gray-300 mt-1">Admin</p>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
