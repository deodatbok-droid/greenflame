'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import { useLocale } from '@/components/providers/LocaleProvider'

type SalonProduct = {
  id: string
  name: string
  unit: string
  package_quantity: number
  package_cost_fcfa: number
}

type PrestationItem = {
  quantity_used: number
  salon_products: SalonProduct
}

type SalonPrestation = {
  id: string
  name: string
  selling_price_fcfa: number
  duration_minutes: number
  notes: string | null
  salon_prestation_products: PrestationItem[]
}

type Tab = 'produits' | 'prestations' | 'simulateur'

function calcPrestationCost(prestation: SalonPrestation): number {
  return prestation.salon_prestation_products.reduce((total, item) => {
    const costPerUnit = item.salon_products.package_cost_fcfa / item.salon_products.package_quantity
    return total + costPerUnit * item.quantity_used
  }, 0)
}

function marginColor(pct: number): string {
  if (pct >= 40) return 'text-green-600'
  if (pct >= 20) return 'text-orange-500'
  return 'text-red-500'
}

function marginBgColor(pct: number): string {
  if (pct >= 40) return 'bg-green-50'
  if (pct >= 20) return 'bg-orange-50'
  return 'bg-red-50'
}

type Props = {
  merchantId: string
  businessName: string
  initialProducts: SalonProduct[]
  initialPrestations: SalonPrestation[]
}

export default function SalonClient({ merchantId: _merchantId, businessName, initialProducts, initialPrestations }: Props) {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>('produits')
  const [products, setProducts] = useState<SalonProduct[]>(initialProducts)
  const [prestations, setPrestations] = useState<SalonPrestation[]>(initialPrestations)

  const [showAddProduct, setShowAddProduct] = useState(false)
  const [prodForm, setProdForm] = useState({ name: '', unit: 'mL', package_quantity: '', package_cost_fcfa: '' })
  const [savingProd, setSavingProd] = useState(false)

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault()
    setSavingProd(true)
    try {
      const res = await fetch('/api/salon/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prodForm.name,
          unit: prodForm.unit,
          package_quantity: parseFloat(prodForm.package_quantity),
          package_cost_fcfa: parseInt(prodForm.package_cost_fcfa, 10),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const newProd = await res.json() as SalonProduct
      setProducts((prev) => [...prev, newProd])
      setProdForm({ name: '', unit: 'mL', package_quantity: '', package_cost_fcfa: '' })
      setShowAddProduct(false)
    } finally {
      setSavingProd(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm(t('merchant.salon.deleteProductConfirm'))) return
    const res = await fetch(`/api/salon/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      setPrestations((prev) =>
        prev.map((pr) => ({
          ...pr,
          salon_prestation_products: pr.salon_prestation_products.filter((item) => item.salon_products.id !== id),
        }))
      )
    }
  }

  const [showAddPrestation, setShowAddPrestation] = useState(false)
  const [editingPrestation, setEditingPrestation] = useState<SalonPrestation | null>(null)
  const [prestForm, setPrestForm] = useState({
    name: '',
    selling_price_fcfa: '',
    duration_minutes: '60',
    notes: '',
  })
  const [prestItems, setPrestItems] = useState<{ product_id: string; quantity_used: string }[]>([])
  const [savingPrest, setSavingPrest] = useState(false)

  function openAddPrestation() {
    setEditingPrestation(null)
    setPrestForm({ name: '', selling_price_fcfa: '', duration_minutes: '60', notes: '' })
    setPrestItems([{ product_id: '', quantity_used: '' }])
    setShowAddPrestation(true)
  }

  function openEditPrestation(prest: SalonPrestation) {
    setEditingPrestation(prest)
    setPrestForm({
      name: prest.name,
      selling_price_fcfa: prest.selling_price_fcfa > 0 ? String(prest.selling_price_fcfa) : '',
      duration_minutes: String(prest.duration_minutes),
      notes: prest.notes ?? '',
    })
    setPrestItems(
      prest.salon_prestation_products.map((item) => ({
        product_id: item.salon_products.id,
        quantity_used: String(item.quantity_used),
      }))
    )
    setShowAddPrestation(true)
  }

  async function handleSavePrestation(e: React.FormEvent) {
    e.preventDefault()
    setSavingPrest(true)
    const items = prestItems
      .filter((i) => i.product_id && i.quantity_used)
      .map((i) => ({ product_id: i.product_id, quantity_used: parseFloat(i.quantity_used) }))

    const payload = {
      name: prestForm.name,
      selling_price_fcfa: prestForm.selling_price_fcfa ? parseInt(prestForm.selling_price_fcfa, 10) : 0,
      duration_minutes: parseInt(prestForm.duration_minutes, 10) || 60,
      notes: prestForm.notes || null,
      items,
    }

    try {
      const url = editingPrestation ? `/api/salon/prestations/${editingPrestation.id}` : '/api/salon/prestations'
      const method = editingPrestation ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const saved = await res.json() as SalonPrestation
      if (editingPrestation) {
        setPrestations((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
      } else {
        setPrestations((prev) => [...prev, saved])
      }
      setShowAddPrestation(false)
      setEditingPrestation(null)
    } finally {
      setSavingPrest(false)
    }
  }

  async function handleDeletePrestation(id: string) {
    if (!confirm(t('merchant.salon.deletePrestConfirm'))) return
    const res = await fetch(`/api/salon/prestations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPrestations((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const formEstimatedCost = prestItems.reduce((total, item) => {
    if (!item.product_id || !item.quantity_used) return total
    const prod = products.find((p) => p.id === item.product_id)
    if (!prod) return total
    const costPerUnit = prod.package_cost_fcfa / prod.package_quantity
    return total + costPerUnit * parseFloat(item.quantity_used || '0')
  }, 0)

  const [simPrestId, setSimPrestId] = useState<string>('')
  const [simPrice, setSimPrice] = useState<number>(0)

  const simPrestation = prestations.find((p) => p.id === simPrestId) ?? null
  const simCost = simPrestation ? Math.round(calcPrestationCost(simPrestation)) : 0
  const simMargin = simPrice - simCost
  const simMarginPct = simPrice > 0 ? Math.round((simMargin / simPrice) * 100) : 0

  function selectSimPrestation(prest: SalonPrestation) {
    setSimPrestId(prest.id)
    const cost = Math.round(calcPrestationCost(prest))
    const suggested = prest.selling_price_fcfa > 0 ? prest.selling_price_fcfa : Math.round(cost * 2)
    setSimPrice(suggested)
  }

  function applyMarginTarget(targetPct: number) {
    if (!simPrestation) return
    const price = Math.round(simCost / (1 - targetPct / 100) / 100) * 100
    setSimPrice(price)
  }

  function printBon() {
    if (!simPrestation) return
    const date = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>${t('merchant.salon.bonTitle')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; padding: 40px; max-width: 420px; margin: auto; }
  .header { text-align: center; border-bottom: 2px solid #166534; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #166534; font-weight: bold; }
  .header p { font-size: 12px; color: #555; margin-top: 4px; }
  .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
  .value { font-size: 16px; font-weight: bold; color: #1a1a1a; margin-bottom: 16px; }
  .price-box { background: #f0fdf4; border: 2px solid #166534; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .price-box .amount { font-size: 36px; font-weight: bold; color: #166534; }
  .price-box .currency { font-size: 14px; color: #555; }
  .footer { margin-top: 32px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  .footer p { font-size: 13px; color: #555; }
  .footer .thanks { font-size: 16px; color: #166534; font-weight: bold; margin-top: 8px; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
  <div class="header">
    <h1>${businessName}</h1>
    <p>${t('merchant.salon.bonTitle')}</p>
    <p style="margin-top:8px; font-size:11px; color:#888;">${t('merchant.salon.bonDate').replace('{date}', date)}</p>
  </div>
  <p class="label">${t('merchant.salon.bonPrestation')}</p>
  <p class="value">${simPrestation.name}</p>
  <p class="label">${t('merchant.salon.bonDuration')}</p>
  <p class="value">${simPrestation.duration_minutes} min</p>
  ${simPrestation.notes ? `<p class="label">${t('merchant.salon.bonNotes')}</p><p class="value" style="font-size:13px; font-weight:normal;">${simPrestation.notes}</p>` : ''}
  <div class="price-box">
    <div class="currency">${t('merchant.salon.bonTotalPrice')}</div>
    <div class="amount">${simPrice.toLocaleString()}</div>
    <div class="currency">FCFA</div>
  </div>
  <div class="footer">
    <p>${t('merchant.salon.bonThanks1')}</p>
    <p class="thanks">${t('merchant.salon.bonThanks2')}</p>
    <p style="font-size:10px; color:#aaa; margin-top:8px;">${t('merchant.salon.bonFooter')}</p>
  </div>
</body></html>`

    const win = window.open('', '_blank', 'width=500,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  const TAB_LABELS: Record<Tab, string> = {
    produits:     t('merchant.salon.tabProducts'),
    prestations:  t('merchant.salon.tabPrestations'),
    simulateur:   t('merchant.salon.tabSimulator'),
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.salon.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('merchant.salon.subtitle')}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.salon.backToTools')}</Link>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['produits', 'prestations', 'simulateur'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === tabKey ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ── TAB: Produits ── */}
      {tab === 'produits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.salon.productsTitle')}</h2>
            {!showAddProduct && (
              <button onClick={() => setShowAddProduct(true)} className="btn-primary text-sm py-2 px-3">
                {t('merchant.salon.addProduct')}
              </button>
            )}
          </div>

          {showAddProduct && (
            <form onSubmit={handleAddProduct} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{t('merchant.salon.newProductTitle')}</p>
              <div>
                <label className="label">{t('merchant.salon.productName')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.salon.productNamePlaceholder')}
                  value={prodForm.name}
                  onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.salon.unit')}</label>
                  <select
                    className="input"
                    value={prodForm.unit}
                    onChange={(e) => setProdForm((f) => ({ ...f, unit: e.target.value }))}
                  >
                    <option value="mL">mL</option>
                    <option value="g">g</option>
                    <option value="application">application</option>
                    <option value="pièce">pièce</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('merchant.salon.packageQty')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="500"
                    value={prodForm.package_quantity}
                    onChange={(e) => setProdForm((f) => ({ ...f, package_quantity: e.target.value }))}
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{t('merchant.salon.packageQtyHint')}</p>
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.salon.packageCost')}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="3500"
                  value={prodForm.package_cost_fcfa}
                  onChange={(e) => setProdForm((f) => ({ ...f, package_cost_fcfa: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingProd} className="btn-primary flex-1">
                  {savingProd ? t('merchant.docs.saving') : t('common.add')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {products.length === 0 && !showAddProduct && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🧴</p>
              <p className="text-gray-500 text-sm">{t('merchant.salon.productsEmpty')}</p>
              <button onClick={() => setShowAddProduct(true)} className="btn-primary mt-4 text-sm py-2 px-4">
                {t('merchant.salon.addProduct')}
              </button>
            </div>
          )}

          {products.map((prod) => {
            const costPerUnit = prod.package_cost_fcfa / prod.package_quantity
            return (
              <div key={prod.id} className="card flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{prod.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {prod.package_quantity} {prod.unit} · {formatFcfa(prod.package_cost_fcfa)} {t('merchant.salon.perBottle')}
                  </p>
                  <p className="text-xs text-brand-600 font-medium mt-0.5">
                    {costPerUnit < 1
                      ? `${costPerUnit.toFixed(2)} FCFA/${prod.unit}`
                      : `${Math.round(costPerUnit)} FCFA/${prod.unit}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteProduct(prod.id)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
                  title={t('common.delete')}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: Prestations ── */}
      {tab === 'prestations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.salon.prestationsTitle')}</h2>
            {!showAddPrestation && (
              <button onClick={openAddPrestation} className="btn-primary text-sm py-2 px-3">
                {t('merchant.salon.createPrestation')}
              </button>
            )}
          </div>

          {showAddPrestation && (
            <form onSubmit={handleSavePrestation} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">
                {editingPrestation ? t('merchant.salon.editPrestTitle') : t('merchant.salon.newPrestTitle')}
              </p>

              <div>
                <label className="label">{t('merchant.salon.prestName')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.salon.prestNamePlaceholder')}
                  value={prestForm.name}
                  onChange={(e) => setPrestForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.salon.duration')}</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="60"
                    value={prestForm.duration_minutes}
                    onChange={(e) => setPrestForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.salon.sellingPrice')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder={t('merchant.salon.sellingPricePlaceholder')}
                    value={prestForm.selling_price_fcfa}
                    onChange={(e) => setPrestForm((f) => ({ ...f, selling_price_fcfa: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('merchant.docs.notes')}</label>
                <textarea
                  className="input min-h-[60px] resize-none"
                  placeholder={t('merchant.salon.prestNotes')}
                  value={prestForm.notes}
                  onChange={(e) => setPrestForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="label mb-2 block">{t('merchant.salon.productsUsed')}</label>
                {products.length === 0 && (
                  <p className="text-xs text-orange-500">{t('merchant.salon.noProductsYet')}</p>
                )}
                <div className="space-y-2">
                  {prestItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="input flex-1 text-sm"
                        value={item.product_id}
                        onChange={(e) =>
                          setPrestItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, product_id: e.target.value } : it))
                          )
                        }
                      >
                        <option value="">{t('merchant.salon.chooseProduct')}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        className="input w-24 text-sm"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Qté"
                        value={item.quantity_used}
                        onChange={(e) =>
                          setPrestItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity_used: e.target.value } : it))
                          )
                        }
                      />
                      {item.product_id && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {products.find((p) => p.id === item.product_id)?.unit}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrestItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPrestItems((prev) => [...prev, { product_id: '', quantity_used: '' }])}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  {t('merchant.salon.addProduct')}
                </button>

                {formEstimatedCost > 0 && (
                  <div className="mt-3 bg-white rounded-xl px-3 py-2 border border-brand-100">
                    <p className="text-xs text-gray-500">{t('merchant.salon.estimatedCost')}</p>
                    <p className="font-bold text-brand-700">{formatFcfa(Math.round(formEstimatedCost))}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={savingPrest} className="btn-primary flex-1">
                  {savingPrest ? t('merchant.docs.saving') : t('merchant.salon.savePrest')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddPrestation(false); setEditingPrestation(null) }}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {prestations.length === 0 && !showAddPrestation && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">✂️</p>
              <p className="text-gray-500 text-sm">{t('merchant.salon.prestationsEmpty')}</p>
              <button onClick={openAddPrestation} className="btn-primary mt-4 text-sm py-2 px-4">
                {t('merchant.salon.createPrestation')}
              </button>
            </div>
          )}

          {prestations.map((prest) => {
            const cost = Math.round(calcPrestationCost(prest))
            const margin = prest.selling_price_fcfa - cost
            const marginPct = prest.selling_price_fcfa > 0
              ? Math.round((margin / prest.selling_price_fcfa) * 100)
              : 0
            const mColor = marginColor(marginPct)

            return (
              <div key={prest.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{prest.name}</p>
                    <p className="text-xs text-gray-400">{prest.duration_minutes} min</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditPrestation(prest)}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded-lg border border-brand-200 bg-brand-50"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeletePrestation(prest.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>

                {prest.salon_prestation_products.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prest.salon_prestation_products.map((item, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {item.salon_products.name} · {item.quantity_used} {item.salon_products.unit}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">{t('merchant.salon.productCostLabel')} <span className="font-medium text-gray-800">{formatFcfa(cost)}</span></span>
                </div>
                {prest.selling_price_fcfa > 0 && (
                  <p className={`text-sm font-medium ${mColor}`}>
                    {t('merchant.salon.sellingPriceLabel')} {formatFcfa(prest.selling_price_fcfa)} · {t('merchant.salon.marginLabel')} {formatFcfa(margin)} ({marginPct}%)
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: Simulateur ── */}
      {tab === 'simulateur' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">{t('merchant.salon.simulatorTitle')}</h2>

          {prestations.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🧮</p>
              <p className="text-gray-500 text-sm">{t('merchant.salon.simulatorEmpty')}</p>
              <button onClick={() => setTab('prestations')} className="btn-primary mt-4 text-sm py-2 px-4">
                {t('merchant.salon.createFirst')}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2">
                {prestations.map((prest) => (
                  <button
                    key={prest.id}
                    onClick={() => selectSimPrestation(prest)}
                    className={`card text-left transition-colors ${
                      simPrestId === prest.id ? 'border-brand-500 bg-brand-50' : 'hover:border-brand-200'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{prest.name}</p>
                    <p className="text-xs text-gray-400">{prest.duration_minutes} min · {t('merchant.salon.productCostLabel')} {formatFcfa(Math.round(calcPrestationCost(prest)))}</p>
                  </button>
                ))}
              </div>

              {simPrestation && (
                <div className="space-y-4">
                  <div className="card">
                    <p className="font-semibold text-gray-900 mb-3 text-sm">{t('merchant.salon.costBreakdown')}</p>
                    <div className="space-y-2">
                      {simPrestation.salon_prestation_products.map((item, i) => {
                        const cpu = item.salon_products.package_cost_fcfa / item.salon_products.package_quantity
                        const itemCost = Math.round(cpu * item.quantity_used)
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-gray-800">{item.salon_products.name}</span>
                              <span className="text-gray-400 ml-2">
                                {item.quantity_used} {item.salon_products.unit} × {cpu < 1 ? cpu.toFixed(2) : Math.round(cpu)} FCFA/{item.salon_products.unit}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{formatFcfa(itemCost)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                      <span className="font-semibold text-gray-700">{t('merchant.salon.totalProductCost')}</span>
                      <span className="font-bold text-gray-900">{formatFcfa(simCost)}</span>
                    </div>
                  </div>

                  <div className="card space-y-3">
                    <p className="font-semibold text-gray-900 text-sm">{t('merchant.salon.sellingPriceSim')}</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={Math.max(simCost, 100)}
                        max={simCost * 5}
                        step={100}
                        value={simPrice}
                        onChange={(e) => setSimPrice(Number(e.target.value))}
                        className="flex-1 accent-brand-600"
                      />
                      <input
                        type="number"
                        className="input w-28 text-right font-bold"
                        min={0}
                        step={100}
                        value={simPrice}
                        onChange={(e) => setSimPrice(Number(e.target.value))}
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-right">FCFA</p>

                    <div className={`rounded-xl p-4 text-center ${marginBgColor(simMarginPct)}`}>
                      <p className="text-xs text-gray-500 mb-1">{t('merchant.salon.grossMargin')}</p>
                      <p className={`text-3xl font-bold ${marginColor(simMarginPct)}`}>{formatFcfa(simMargin)}</p>
                      <p className={`text-lg font-semibold ${marginColor(simMarginPct)}`}>{simMarginPct}%</p>
                    </div>

                    <div className="flex gap-2">
                      {[30, 50, 70].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => applyMarginTarget(pct)}
                          className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
                        >
                          {t('merchant.salon.marginTarget').replace('{pct}', String(pct))}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={printBon} className="w-full btn-primary py-3 text-sm">
                    {t('merchant.salon.printBon')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
