import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import Image from 'next/image'
import Link from 'next/link'
import { getServerT } from '@/lib/i18n/server'

export const revalidate = 60

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const { t } = await getServerT()
  const svc = createServiceClient()
  const { data: m } = await svc
    .from('merchants')
    .select('business_name, address_text')
    .eq('public_slug', slug)
    .eq('is_active', true)
    .single()
  if (!m) return { title: t('boutique.notFound') }
  return {
    title: `${m.business_name} — GreenFlame`,
    description: `${m.business_name}${m.address_text ? ' · ' + m.address_text : ''} sur GreenFlame.`,
  }
}

export default async function BoutiquePage({ params }: Props) {
  const { slug } = await params
  const { t, locale } = await getServerT()
  const svc = createServiceClient()

  // Charger le marchand
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, address_text, qr_code_url, subscription_tier, subscription_expires_at, created_at')
    .eq('public_slug', slug)
    .eq('is_active', true)
    .single()

  if (!merchant) notFound()

  // Charger les produits actifs (hors subscription_trigger)
  const { data: products } = await svc
    .from('products')
    .select('id, name, description, price_fcfa, emoji, image_url, stock_quantity, featured_until')
    .eq('merchant_id', merchant.id)
    .eq('is_available', true)
    .is('subscription_trigger', null)
    .order('featured_until', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: true })

  const isVip = merchant.subscription_tier === 'vip'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()
  const isPro = !isVip && merchant.subscription_tier === 'pro'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()

  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
  const memberSince = new Date(merchant.created_at).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header boutique */}
      <div className={`relative px-4 pt-10 pb-6 text-white ${isVip ? 'bg-gradient-to-br from-amber-600 to-amber-800' : isPro ? 'bg-gradient-to-br from-brand-700 to-brand-900' : 'bg-gradient-to-br from-gray-700 to-gray-900'}`}>
        <div className="max-w-4xl mx-auto">
          {/* Badge tier */}
          {isVip && (
            <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full mb-3">
              {t('boutique.vipBadge')}
            </span>
          )}
          {isPro && (
            <span className="inline-flex items-center gap-1 bg-brand-400 text-brand-900 text-xs font-bold px-2 py-0.5 rounded-full mb-3">
              {t('boutique.proBadge')}
            </span>
          )}

          <h1 className="text-2xl font-bold">{merchant.business_name}</h1>
          {merchant.address_text && (
            <p className="text-sm opacity-80 mt-1">📍 {merchant.address_text}</p>
          )}
          <p className="text-xs opacity-60 mt-1">{t('boutique.memberSince')} {memberSince}</p>

          {/* Stats */}
          <div className="flex gap-4 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold">{products?.length ?? 0}</p>
              <p className="text-xs opacity-70">{t('boutique.products')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* CTA paiement GreenFlame */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
          <div className="text-3xl">🔥</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{t('boutique.payWithGf')}</p>
            <p className="text-xs text-gray-500">{t('boutique.payWithGfSubtitle')}</p>
          </div>
          <Link
            href={`/login?redirect=/boutique/${slug}`}
            className="flex-shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {t('boutique.signIn')}
          </Link>
        </div>

        {/* Produits */}
        {(!products || products.length === 0) ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🛍️</p>
            <p className="font-medium text-gray-500">{t('boutique.noProducts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-900">{t('boutique.ourProducts')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map(p => {
                const isFeatured = p.featured_until && new Date(p.featured_until) > new Date()
                return (
                  <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${isFeatured ? 'border-amber-300' : 'border-gray-200'}`}>
                    {/* Image / emoji */}
                    <div className="w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} width={200} height={200} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-4xl">{p.emoji}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      {isFeatured && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full mb-1 inline-block">
                          {t('boutique.newBadge')}
                        </span>
                      )}
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
                      <div className="mt-2">
                        <p className="font-bold text-brand-600 text-sm">{formatFcfa(p.price_fcfa)}</p>
                        {p.stock_quantity !== null && (
                          <p className={`text-xs mt-0.5 ${p.stock_quantity === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {p.stock_quantity === 0 ? t('boutique.outOfStock') : `${t('boutique.stock')} ${p.stock_quantity}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* QR Code */}
        {merchant.qr_code_url && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('boutique.scanToPay')}</p>
            <Image src={merchant.qr_code_url} alt="QR Code" width={160} height={160} className="mx-auto rounded-xl" />
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-6">
          <Link href="/" className="text-xs text-gray-400 hover:text-brand-600">
            {t('boutique.poweredBy')}
          </Link>
        </div>
      </div>
    </div>
  )
}
