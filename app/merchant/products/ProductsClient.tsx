'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from '@/components/providers/LocaleProvider'
import { useDemo } from '@/lib/demo/DemoContext'
import { DEMO_PRODUCT } from '@/lib/demo/data'

// ── Types ──────────────────────────────────────────────────────
type MktCategory = {
  id: string
  slug: string
  name: string
  icon: string | null
  color_bg: string
  color_icon: string
  parent_id: string | null
}

type Product = {
  id: string
  name: string
  description: string | null
  price_fcfa: number
  emoji: string
  image_url: string | null
  category: string
  subcategory: string | null
  is_available: boolean
  stock_quantity: number | null
  commission_rate: number | null
  sort_order: number
  marketplace_category_id: string | null
  marketplace_subcategory_id: string | null
  mkt_cat_name?: string | null
  mkt_sub_name?: string | null
}

const DEFAULT_EMOJIS = ['📦','🛒','🍽️','💄','💊','📱','👗','🔧','🌿','🏠','⚡','🏗️','💧','🎨']

type Step = 'category' | 'form'
type Props = { tier: 'free' | 'pro' | 'vip'; productLimit: number; isHub?: boolean }

export default function ProductsClient({ tier, productLimit, isHub = false }: Props) {
  const supabase = createClient()
  const { t } = useLocale()
  const { isDemo, markStepComplete } = useDemo()
  const isFree = tier === 'free'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [mktCategories, setMktCategories] = useState<MktCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [step, setStep] = useState<Step>('category')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSubId, setSelectedSubId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [stockType, setStockType] = useState<'unlimited' | 'quantity'>('unlimited')
  const [quantity, setQuantity] = useState('')
  const [commissionOverride, setCommissionOverride] = useState<'default' | 'custom'>('default')
  const [customRate, setCustomRate] = useState('')
  const [aiReason, setAiReason] = useState<string | null>(null)

  const rootCats = mktCategories.filter(c => !c.parent_id)
  const subCats = mktCategories.filter(c => c.parent_id === selectedCatId)
  const selectedCat = mktCategories.find(c => c.id === selectedCatId)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: m } = await supabase.from('merchants').select('id').eq('user_id', user.id).single()
    if (!m) return
    setMerchantId(m.id)

    const { data: p } = await supabase
      .from('products')
      .select(`
        id, name, description, price_fcfa, emoji, image_url, category, subcategory,
        is_available, stock_quantity, commission_rate, sort_order,
        marketplace_category_id, marketplace_subcategory_id,
        mkt_cat:marketplace_categories!marketplace_category_id(name),
        mkt_sub:marketplace_categories!marketplace_subcategory_id(name)
      `)
      .eq('merchant_id', m.id)
      .order('sort_order')

    setProducts((p ?? []).map((x: any) => ({
      ...x,
      mkt_cat_name: x.mkt_cat?.name ?? null,
      mkt_sub_name: x.mkt_sub?.name ?? null,
    })))

    const { data: cats } = await supabase
      .from('marketplace_categories')
      .select('id, slug, name, icon, color_bg, color_icon, parent_id')
      .eq('is_active', true)
      .order('sort_order')
    setMktCategories(cats ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load().then(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('action') === 'new') {
        resetForm()
        setStep('category')
        setShowForm(true)
      }
    })
  }, [load])

  function resetForm() {
    setEditId(null)
    setSelectedCatId(''); setSelectedSubId(''); setName(''); setDescription('')
    setPrice(''); setEmoji('📦'); setImageUrl(null)
    setStockType('unlimited'); setQuantity('')
    setCommissionOverride('default'); setCustomRate(''); setAiReason(null)
  }

  function openNew() {
    resetForm()
    setStep('category')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openDemoProduct() {
    resetForm()
    const alimCat = rootCats.find(c =>
      c.slug?.toLowerCase().includes('aliment') ||
      c.name?.toLowerCase().includes('aliment')
    )
    if (alimCat) setSelectedCatId(alimCat.id)
    setName(DEMO_PRODUCT.name)
    setDescription(DEMO_PRODUCT.description)
    setPrice(String(DEMO_PRODUCT.price))
    setEmoji('🛢️')
    setStockType('quantity')
    setQuantity(String(DEMO_PRODUCT.stock))
    setStep('form')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openEdit(p: Product) {
    setEditId(p.id)
    setSelectedCatId(p.marketplace_category_id ?? '')
    setSelectedSubId(p.marketplace_subcategory_id ?? '')
    setName(p.name)
    setDescription(p.description ?? '')
    setPrice(String(p.price_fcfa))
    setEmoji(p.emoji)
    setImageUrl(p.image_url)
    setStockType(p.stock_quantity !== null ? 'quantity' : 'unlimited')
    setQuantity(p.stock_quantity !== null ? String(p.stock_quantity) : '')
    setCommissionOverride(p.commission_rate !== null ? 'custom' : 'default')
    setCustomRate(p.commission_rate !== null ? String(p.commission_rate * 100) : '')
    setAiReason(null)
    setStep('form')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectCategory(id: string) {
    setSelectedCatId(id); setSelectedSubId(''); setAiReason(null); setStep('form')
  }

  function closeForm() { setShowForm(false); setStep('category'); setAiReason(null) }

  // ── Upload image ──────────────────────────────────────────────
  async function uploadImage(file: File) {
    if (!merchantId) return
    if (file.size > 5 * 1024 * 1024) { toast.error(t('merchant.products.imageTooLarge')); return }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${merchantId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })

      if (error) { toast.error(t('merchant.products.uploadError') + ': ' + error.message); return }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)

      setImageUrl(publicUrl)
      toast.success(t('merchant.products.imageAdded'))
    } finally {
      setUploading(false)
    }
  }

  // ── Suggestion IA ──────────────────────────────────────────────
  async function suggestCategory() {
    if (!name.trim()) { toast.error(t('merchant.products.enterNameFirst')); return }
    setSuggesting(true); setAiReason(null)
    try {
      const res = await fetch('/api/ai/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { toast.error(data.error ?? t('merchant.products.aiError')); return }
      if (data.category_id) {
        setSelectedCatId(data.category_id)
        setSelectedSubId(data.subcategory_id ?? '')
        setAiReason(`${data.reason} (confiance ${Math.round((data.confidence ?? 0) * 100)}%)`)
        toast.success(
          t('merchant.products.aiSuggests')
            .replace('{cat}', data.category_name)
            .replace('{sub}', data.subcategory_name)
        )
      } else {
        toast.error(t('merchant.products.categoryNotFound'))
      }
    } finally { setSuggesting(false) }
  }

  // ── Sauvegarde ────────────────────────────────────────────────
  async function save() {
    if (!name.trim()) { toast.error(t('merchant.products.nameRequired')); return }
    if (!price) { toast.error(t('merchant.products.priceRequired')); return }
    if (!merchantId) { toast.error(t('merchant.products.merchantNotFound')); return }
    const priceNum = parseInt(price.replace(/\D/g, ''))
    if (!priceNum || priceNum <= 0) { toast.error(t('merchant.products.invalidPrice')); return }

    const stockQty = stockType === 'quantity' ? (parseInt(quantity) || null) : null
    const commRate = commissionOverride === 'custom' ? (parseFloat(customRate) / 100 || null) : null
    setSaving(true)

    const catSlug = mktCategories.find(c => c.id === selectedCatId)?.slug ?? 'ALIMENTATION'
    const legacyCat = catSlug.toUpperCase().replace(/-/g, '_').slice(0, 20)

    const payload = {
      name:                       name.trim(),
      description:                description.trim() || null,
      price_fcfa:                 priceNum,
      category:                   legacyCat,
      subcategory:                mktCategories.find(c => c.id === selectedSubId)?.name ?? null,
      emoji,
      image_url:                  imageUrl,
      stock_quantity:             stockQty,
      commission_rate:            commRate,
      marketplace_category_id:    selectedCatId || null,
      marketplace_subcategory_id: selectedSubId || null,
    }

    if (isHub) Object.assign(payload, { is_available: true })

    if (editId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setProducts(prev => prev.map(p => p.id === editId
        ? { ...p, ...payload,
            mkt_cat_name: mktCategories.find(c => c.id === selectedCatId)?.name ?? null,
            mkt_sub_name: mktCategories.find(c => c.id === selectedSubId)?.name ?? null,
          } : p))
      toast.success(t('merchant.products.productUpdated'))
    } else {
      const featuredUntil = tier === 'vip'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { data, error } = await supabase.from('products').insert({
        merchant_id:   merchantId,
        ...payload,
        is_available:  true,
        sort_order:    products.length,
        featured_until: featuredUntil,
      }).select().single()
      if (error || !data) { toast.error(error?.message ?? t('merchant.products.addError')); setSaving(false); return }
      setProducts(prev => [...prev, {
        ...data,
        mkt_cat_name: mktCategories.find(c => c.id === selectedCatId)?.name ?? null,
        mkt_sub_name: mktCategories.find(c => c.id === selectedSubId)?.name ?? null,
      }])
      markStepComplete('produits')
      toast.success(tier === 'vip' ? t('merchant.products.vipAdded') : t('merchant.products.productAdded'))
    }
    setSaving(false)
    closeForm()
  }

  async function toggleAvailable(p: Product) {
    if (isHub) return
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }

  async function adjustStock(p: Product, delta: number) {
    if (p.stock_quantity === null) return
    const next = Math.max(0, p.stock_quantity + delta)
    await supabase.from('products').update({ stock_quantity: next }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock_quantity: next } : x))
  }

  async function deleteProduct(id: string) {
    if (!confirm(t('merchant.products.deleteConfirm'))) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    toast.success(t('merchant.products.productDeleted'))
  }

  if (loading) return <div className="p-8 text-center text-gray-500">{t('merchant.products.loading')}</div>

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('merchant.products.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('merchant.products.count').replace('{n}', String(products.length))}
          </p>
        </div>
        <Link href="/merchant/dashboard" className="text-brand-600 text-sm">
          {t('merchant.products.backToDashboard')}
        </Link>
      </div>

      {/* Alerte limite free */}
      {isFree && products.length >= productLimit - 2 && products.length < productLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {t('merchant.products.slotsLeft').replace('{n}', String(productLimit - products.length))}
            </p>
            <p className="text-xs text-amber-600">
              {t('merchant.products.freePlanLimit').replace('{n}', String(productLimit))}
            </p>
          </div>
          <a href="/merchant/upgrade" className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg">
            {t('merchant.products.upgradePro')}
          </a>
        </div>
      )}

      {/* Bloqué si limite */}
      {isFree && products.length >= productLimit ? (
        <div className="bg-gradient-to-r from-brand-700 to-brand-600 rounded-2xl p-5 text-white text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="font-bold mb-1">
            {t('merchant.products.limitReached').replace('{n}', String(productLimit))}
          </p>
          <p className="text-brand-200 text-sm mb-4">{t('merchant.products.limitReachedDesc')}</p>
          <a href="/merchant/upgrade" className="inline-block bg-white text-brand-700 font-bold px-6 py-2.5 rounded-xl text-sm">
            {t('merchant.products.upgradeProPrice')}
          </a>
        </div>
      ) : (
        !showForm && (
          <div className="space-y-2">
            {isDemo && (
              <button
                onClick={openDemoProduct}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.25)' }}
              >
                🎬 ✦ Ajouter un produit démo
              </button>
            )}
            <button onClick={openNew} className="btn-primary w-full py-3.5 text-base">
              {t('merchant.products.addProduct')}
              {isFree && (
                <span className="ml-2 text-brand-200 text-xs">
                  ({productLimit - products.length} {t('merchant.products.remaining')})
                </span>
              )}
            </button>
          </div>
        )
      )}

      {/* ── FORMULAIRE ── */}
      {showForm && (
        <div className="rounded-2xl border border-brand-200 bg-white shadow-md overflow-hidden">

          {/* Étape 1 : choix catégorie */}
          {step === 'category' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">{t('merchant.products.chooseCategory')}</p>
                <button onClick={closeForm} className="text-gray-500 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              {rootCats.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">{t('merchant.products.loadingCategories')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {rootCats.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCategory(c.id)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-300 hover:bg-brand-50 transition-all text-left"
                    >
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ background: c.color_bg, color: c.color_icon }}
                      >
                        <i className={`ti ti-${c.icon ?? 'shopping-bag'}`} aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium text-gray-800 leading-tight">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Étape 2 : formulaire produit */}
          {step === 'form' && (
            <div>
              {/* Header catégorie */}
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ background: selectedCat?.color_bg ?? '#E1F5EE' }}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${selectedCat?.color_icon ?? '#0F6E56'}20`, color: selectedCat?.color_icon ?? '#0F6E56' }}
                >
                  <i className={`ti ti-${selectedCat?.icon ?? 'shopping-bag'}`} aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: selectedCat?.color_icon ?? '#0F6E56' }}>
                    {selectedCat?.name ?? t('merchantActivate.categoryLabel')}
                  </p>
                  <button
                    onClick={() => setStep('category')}
                    className="text-xs hover:underline"
                    style={{ color: `${selectedCat?.color_icon ?? '#0F6E56'}99` }}
                  >
                    {t('merchant.products.changeCategory')}
                  </button>
                </div>
                <button onClick={closeForm} className="text-gray-500 hover:text-gray-600 text-xl leading-none">×</button>
              </div>

              <div className="p-4 space-y-3">

                {/* Sous-catégorie */}
                {subCats.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {t('merchant.products.subcategoryLabel')}
                    </label>
                    <select
                      value={selectedSubId}
                      onChange={e => setSelectedSubId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    >
                      <option value="">{t('merchant.products.subcategoryPlaceholder')}</option>
                      {subCats.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Nom */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {t('merchant.products.nameLabel')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t('merchant.products.namePlaceholder')}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                    <button
                      onClick={suggestCategory}
                      disabled={suggesting || !name.trim()}
                      title={t('merchant.products.aiHint')}
                      className="flex-shrink-0 px-3 py-2 rounded-xl border border-brand-200 text-brand-600 text-xs font-medium hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {suggesting ? '…' : '✨ IA'}
                    </button>
                  </div>
                  {aiReason && (
                    <p className="mt-1 text-xs text-brand-600 bg-brand-50 rounded-lg px-2 py-1">
                      ✨ {aiReason}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {t('merchant.products.descriptionLabel')}
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    placeholder={t('merchant.products.descriptionPlaceholder')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-400"
                  />
                </div>

                {/* Prix */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {t('merchant.products.priceLabel')}
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="500"
                    min={0}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                </div>

                {/* Photo du produit */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {t('merchant.products.photoLabel')}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) uploadImage(file)
                      e.target.value = ''
                    }}
                  />

                  {imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <div className="relative h-36 w-full">
                        <Image
                          src={imageUrl}
                          alt="Aperçu"
                          fill
                          className="object-contain"
                          unoptimized={imageUrl.startsWith('http')}
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="bg-white/90 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg shadow hover:bg-white transition-colors"
                        >
                          {uploading ? '…' : t('merchant.products.changePhoto')}
                        </button>
                        <button
                          onClick={() => setImageUrl(null)}
                          className="bg-red-500/90 text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow hover:bg-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-brand-300 hover:text-brand-500 transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <span className="text-sm">{t('merchant.products.uploading')}</span>
                      ) : (
                        <>
                          <span className="text-2xl">📷</span>
                          <span className="text-xs font-medium">{t('merchant.products.addPhoto')}</span>
                          <span className="text-[10px]">{t('merchant.products.photoHint')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Emoji (affiché si pas de photo) */}
                {!imageUrl && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {t('merchant.products.iconLabel')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_EMOJIS.map(e => (
                        <button
                          key={e}
                          onClick={() => setEmoji(e)}
                          className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${emoji === e ? 'bg-brand-100 border-2 border-brand-400' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {t('merchant.products.stockLabel')}
                  </label>
                  <div className="flex gap-2">
                    {(['unlimited', 'quantity'] as const).map(sType => (
                      <button
                        key={sType}
                        onClick={() => setStockType(sType)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${stockType === sType ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                      >
                        {sType === 'unlimited'
                          ? t('merchant.products.stockUnlimited')
                          : t('merchant.products.stockQuantity')}
                      </button>
                    ))}
                  </div>
                  {stockType === 'quantity' && (
                    <input
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder={t('merchant.products.stockPlaceholder')}
                      min={0}
                      className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                  )}
                </div>

                {/* Commission override (Pro/VIP) */}
                {tier !== 'free' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {t('merchant.products.commissionLabel')}
                    </label>
                    <div className="flex gap-2">
                      {(['default', 'custom'] as const).map(cType => (
                        <button
                          key={cType}
                          onClick={() => setCommissionOverride(cType)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${commissionOverride === cType ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}
                        >
                          {cType === 'default'
                            ? t('merchant.products.commissionDefault')
                            : t('merchant.products.commissionCustom')}
                        </button>
                      ))}
                    </div>
                    {commissionOverride === 'custom' && (
                      <input
                        type="number"
                        value={customRate}
                        onChange={e => setCustomRate(e.target.value)}
                        placeholder={t('merchant.products.commissionPlaceholder')}
                        min={1}
                        max={30}
                        className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                      />
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={closeForm} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                    {t('merchant.products.cancel')}
                  </button>
                  <button
                    onClick={save}
                    disabled={saving || uploading}
                    className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-60"
                  >
                    {saving
                      ? t('merchant.products.saving')
                      : editId
                      ? t('merchant.products.update')
                      : t('merchant.products.addBtn')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LISTE DES PRODUITS ── */}
      {products.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-3">🛍️</p>
          <p className="font-semibold text-gray-600">{t('merchant.products.emptyTitle')}</p>
          <p className="text-sm mt-1">{t('merchant.products.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border p-4 transition-all ${p.is_available ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
                {/* Vignette image ou emoji */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                      unoptimized={p.image_url.startsWith('http')}
                    />
                  ) : (
                    <span className="text-2xl">{p.emoji}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/marketplace/produit/${p.id}`}
                      className="font-semibold text-gray-900 text-sm hover:text-brand-600 hover:underline transition-colors"
                    >
                      {p.name}
                    </Link>
                    {p.mkt_cat_name && (
                      <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                        {p.mkt_cat_name}{p.mkt_sub_name ? ` › ${p.mkt_sub_name}` : ''}
                      </span>
                    )}
                  </div>
                  {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <p className="font-bold text-brand-700 text-sm">{formatFcfa(p.price_fcfa)} FCFA</p>
                    {p.stock_quantity !== null && (
                      <span className={`text-xs font-medium ${p.stock_quantity === 0 ? 'text-red-500' : p.stock_quantity <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                        {p.stock_quantity === 0
                          ? t('merchant.products.outOfStock')
                          : `${t('merchant.products.stockPrefix')} ${p.stock_quantity}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {isHub ? (
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-green-100 text-green-700 cursor-default select-none">
                      {t('merchant.products.activeStatus')}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleAvailable(p)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${p.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {p.is_available ? t('merchant.products.online') : t('merchant.products.hidden')}
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                    {t('merchant.products.edit')}
                  </button>
                  <Link
                    href={`/marketplace/produit/${p.id}`}
                    className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 text-center"
                    target="_blank"
                  >
                    {t('merchant.products.viewProduct')}
                  </Link>
                </div>
              </div>

              {/* Contrôle stock */}
              {p.stock_quantity !== null && (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                  <span className="text-xs text-gray-500">{t('merchant.products.stockAdjust')}</span>
                  <button onClick={() => adjustStock(p, -1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 flex items-center justify-center">−</button>
                  <span className="text-sm font-semibold w-8 text-center">{p.stock_quantity}</span>
                  <button onClick={() => adjustStock(p, 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 flex items-center justify-center">+</button>
                  <button onClick={() => deleteProduct(p.id)} className="ml-auto text-xs text-red-400 hover:text-red-600">
                    {t('merchant.products.delete')}
                  </button>
                </div>
              )}
              {p.stock_quantity === null && (
                <div className="flex justify-end mt-1">
                  <button onClick={() => deleteProduct(p.id)} className="text-xs text-red-400 hover:text-red-600">
                    {t('merchant.products.delete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

