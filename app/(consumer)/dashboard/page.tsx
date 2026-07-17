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
import FlammeMiniBar from '@/components/consumer/FlammeMiniBar'
import LifeGoalsWidget from '@/components/consumer/LifeGoalsWidget'
import { SectionHeader } from '@/components/ui/SectionHeader'

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
    supabase.from('user_scores').select('score, niveau').eq('user_id', user.id).single(),
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
              {nextTarget ? (
                <span className="shrink-0">{nextTarget - networkSize} onboarding{nextTarget - networkSize > 1 ? 's' : ''} pour le niveau {level + 1}</span>
              ) : (
                <span className="shrink-0 text-brand-500 font-medium">Niveau maximum 🏆</span>
              )}
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-flame-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(levelPct, levelPct > 0 ? 4 : 0)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {networkSize === 0
                ? 'Ta communauté se construit dès le premier onboarding que tu fais.'
                : `${networkSize} membre${networkSize > 1 ? 's' : ''} dans ta communauté`}
            </p>
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
                {t('dashboard.academieFree')}
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

        {/* ── PORTEFEUILLE IMMERSIF ── */}
        <div className="relative rounded-3xl overflow-hidden text-white shadow-xl">
          {/* Gradient de fond multi-couche */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600" />
          {/* Cercles décoratifs flottants */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -left-4 w-32 h-32 rounded-full bg-flame-500/20" />
          <div className="absolute top-1/2 right-6 w-16 h-16 rounded-full bg-white/5" />

          {/* Contenu */}
          <div className="relative z-10 p-5">
            {/* Label */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-brand-200 text-xs font-medium tracking-wide uppercase">{t('dashboard.myWallet')}</p>
              <span className="text-base opacity-60">🔥</span>
            </div>

            {/* Solde principal */}
            <div className="mb-4">
              <p className="text-4xl font-black tracking-tight leading-none">
                {wallet
                  ? formatFcfa(wallet.balance_fcfa + Math.floor((wallet.balance_gfp ?? 0) * GOVERNANCE.GFP_TO_FCFA_RATE))
                  : '—'
                }
              </p>
              <p className="text-brand-300 text-sm font-medium mt-1">FCFA</p>
            </div>

            {/* Détail GFP si présent */}
            {wallet && (wallet.balance_gfp ?? 0) > 0 && (() => {
              const gfp = wallet.balance_gfp ?? 0
              const remainder = gfp % 10
              return remainder > 0 ? (
                <p className="text-brand-300/80 text-xs mb-4 bg-white/10 rounded-xl px-3 py-1.5 inline-block">
                  + {remainder} GFP non convertis
                </p>
              ) : null
            })()}

            {/* Séparateur */}
            <div className="w-full h-px bg-white/10 mb-4" />

            {/* Actions */}
            <div className="flex gap-2.5">
              <Link href="/wallet" className="flex-1">
                <button className="w-full bg-white/15 hover:bg-white/25 active:bg-white/30 transition-all text-white text-xs font-semibold py-2.5 rounded-2xl border border-white/20">
                  {t('nav.wallet')} →
                </button>
              </Link>
              <Link href="/pay" className="flex-1">
                <button className="w-full bg-flame-500 hover:bg-flame-400 active:bg-flame-600 transition-all text-white text-xs font-bold py-2.5 rounded-2xl shadow-lg shadow-flame-900/30">
                  {t('dashboard.payNow')} 🔥
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/wallet">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-brand-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-brand-700">+{formatFcfa(monthlyCashback)}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{t('dashboard.cashback')}</p>
              <p className="text-[10px] text-brand-400 mt-1 leading-tight">Tes achats ce mois</p>
            </div>
          </Link>
          <Link href="/wallet">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-indigo-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-indigo-700">+{formatFcfa(monthlyNetwork)}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{t('dashboard.networkDividend')}</p>
              <p className="text-[10px] text-indigo-400 mt-1 leading-tight">Ta communauté achète</p>
            </div>
          </Link>
          <Link href="/profile">
            <div className="bg-white rounded-xl p-3 border border-gray-100 hover:border-green-200 transition-colors cursor-pointer">
              <p className="text-base font-bold text-green-700">{networkSize}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">Communauté</p>
              <p className="text-[10px] text-green-500 mt-1 leading-tight">
                {networkSize === 0 ? 'Partage ton lien →' : `${networkSize} membre${networkSize > 1 ? 's' : ''}`}
              </p>
            </div>
          </Link>
        </div>

        {/* ── FLAMME PROGRESS BAR ── */}
        <FlammeMiniBar />

        {/* ── BUDGET — accès rapide ── */}
        <Link href="/budget">
          <div className="relative rounded-2xl overflow-hidden cursor-pointer group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500" />
            <div className="absolute -top-5 -right-5 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -left-3 w-24 h-24 rounded-full bg-white/5" />
            <div className="absolute top-3 right-12 w-10 h-10 rounded-full bg-white/5" />
            <div className="relative z-10 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                💰
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-emerald-200 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Gestion personnelle</p>
                <p className="font-bold text-white text-base leading-tight">Mon Budget</p>
                <p className="text-emerald-200/80 text-xs mt-0.5">Revenus · Dépenses · Épargne</p>
              </div>
              <span className="text-white/50 text-xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

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
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-semibold text-gray-900">{t('dashboard.recentTransactions')}</h2>
            <Link href="/history" className="text-xs text-brand-600 font-medium">{t('common.viewAll')} →</Link>
          </div>
          <p className="text-xs text-gray-400 mb-3">Chaque paiement te rapporte du cashback crédité instantanément.</p>

          {transactions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-3xl mb-2">🛍️</p>
              <p className="font-semibold text-gray-700 text-sm">{t('dashboard.noTransactions')}</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Paye chez un marchand GreenFlame pour voir ton cashback ici.</p>
              <Link href="/pay">
                <button className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors">
                  Payer maintenant →
                </button>
              </Link>
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
        <LifeGoalsWidget monthlyIncome={monthlyIncome} />

        {/* ── CAGNOTTE COMMUNAUTAIRE ── */}
        <CagnotteWidget />

        {/* ── LIEN D'INVITATION ── */}
        {isNewUser && !isAdmin ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                🔒
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-600">Lien d'invitation verrouillé</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fais ton premier achat pour débloquer ton lien et commencer à onboarder des membres.
                </p>
              </div>
            </div>
            <Link href="/pay">
              <button className="mt-3 w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                {t('dashboard.makeFirstPurchase')}
              </button>
            </Link>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-brand-50 to-fuchsia-50 border border-brand-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-0.5 font-semibold uppercase tracking-wide">Ton lien d'invitation</p>
            <p className="text-xs text-gray-400 mb-2">Chaque personne inscrite via ton lien rejoint ta communauté — tu gagnes sur ses achats jusqu'au Cercle 5.</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-bold font-mono text-brand-700">{profile?.referral_code}</p>
              <CopyReferralButton referralUrl={referralUrl} code={profile?.referral_code ?? ''} />
            </div>
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
