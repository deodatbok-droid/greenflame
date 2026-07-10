'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

// ── Types ──────────────────────────────────────────────────────────────────

type BtpMateriau = {
  id: string
  name: string
  unit: string
  price_per_unit_fcfa: number
  category: string
}

type BtpChantierMateriau = {
  id: string
  materiau_id: string | null
  nom_materiau: string
  unit: string
  quantity_needed: number
  price_per_unit_fcfa: number
}

type BtpChantier = {
  id: string
  client_name: string
  client_phone: string | null
  description: string
  adresse: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  status: 'en_cours' | 'termine' | 'annule'
  prix_total_fcfa: number
  avance_versee_fcfa: number
  notes: string | null
  btp_chantier_materiaux: BtpChantierMateriau[]
}

type AiItem = {
  name: string
  unit: string
  quantity: number
  category: string
  note?: string
  price_per_unit_fcfa: number
}

type Tab = 'materiaux' | 'chantiers' | 'estimateur'

type StatusFilter = 'tous' | 'en_cours' | 'termine'

// ── Constants ───────────────────────────────────────────────────────────────

const UNITS = ['sac', 'tonne', 'kg', 'm³', 'm²', 'm', 'pièce', 'L', 'rouleau', 'barre']
const CATEGORIES = ['gros_oeuvre', 'finition', 'electricite', 'plomberie', 'menuiserie', 'autre']

// ── Helpers ─────────────────────────────────────────────────────────────────

function calcChantierCoutMateriaux(chantier: BtpChantier): number {
  return chantier.btp_chantier_materiaux.reduce(
    (s, m) => s + m.quantity_needed * m.price_per_unit_fcfa,
    0
  )
}

function calcSolde(chantier: BtpChantier): number {
  return chantier.prix_total_fcfa - chantier.avance_versee_fcfa
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  merchantId: string
  businessName: string
  initialMateriaux: BtpMateriau[]
  initialChantiers: BtpChantier[]
}

// ── Composant principal ─────────────────────────────────────────────────────

export default function BtpClient({
  merchantId: _merchantId,
  businessName,
  initialMateriaux,
  initialChantiers,
}: Props) {
  const { t } = useLocale()

  const CAT_LABELS: Record<string, string> = {
    gros_oeuvre: t('merchant.btp.catGrosOeuvre'),
    finition:    t('merchant.btp.catFinition'),
    electricite: t('merchant.btp.catElectricite'),
    plomberie:   t('merchant.btp.catPlomberie'),
    menuiserie:  t('merchant.btp.catMenuiserie'),
    autre:       t('merchant.btp.catAutre'),
  }

  const TAB_LABELS: Record<Tab, string> = {
    materiaux:  t('merchant.btp.tabMateriaux'),
    chantiers:  t('merchant.btp.tabChantiers'),
    estimateur: t('merchant.btp.tabEstimateur'),
  }

  const FILTER_LABELS: Record<StatusFilter, string> = {
    tous:      t('merchant.btp.filterAll'),
    en_cours:  t('merchant.btp.filterEnCours'),
    termine:   t('merchant.btp.filterTermine'),
  }

  const STATUS_LABELS: Record<BtpChantier['status'], string> = {
    en_cours: t('merchant.btp.statusEnCours'),
    termine:  t('merchant.btp.statusTermine'),
    annule:   t('merchant.btp.statusAnnule'),
  }

  const [tab, setTab] = useState<Tab>('materiaux')
  const [materiaux, setMateriaux] = useState<BtpMateriau[]>(initialMateriaux)
  const [chantiers, setChantiers] = useState<BtpChantier[]>(initialChantiers)

  // ── Onglet Matériaux ───────────────────────────────────────────────────────

  const [showAddMateriau, setShowAddMateriau] = useState(false)
  const [matForm, setMatForm] = useState({
    name: '',
    category: 'gros_oeuvre',
    unit: 'sac',
    price_per_unit_fcfa: '',
  })
  const [savingMat, setSavingMat] = useState(false)

  async function handleAddMateriau(e: React.FormEvent) {
    e.preventDefault()
    setSavingMat(true)
    try {
      const res = await fetch('/api/btp/materiaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: matForm.name,
          unit: matForm.unit,
          price_per_unit_fcfa: parseInt(matForm.price_per_unit_fcfa, 10),
          category: matForm.category,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? 'Erreur')
        return
      }
      const newMat = await res.json() as BtpMateriau
      setMateriaux((prev) =>
        [...prev, newMat].sort((a, b) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        )
      )
      setMatForm({ name: '', category: 'gros_oeuvre', unit: 'sac', price_per_unit_fcfa: '' })
      setShowAddMateriau(false)
      toast.success(t('merchant.btp.matAdded'))
    } finally {
      setSavingMat(false)
    }
  }

  async function handleDeleteMateriau(id: string) {
    if (!confirm(t('merchant.btp.deleteMatConfirm'))) return
    const res = await fetch(`/api/btp/materiaux/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error(t('merchant.btp.deleteError')); return }
    setMateriaux((prev) => prev.filter((m) => m.id !== id))
    toast.success(t('merchant.btp.matDeleted'))
  }

  // Groupement par catégorie
  const materiauxByCategory = CATEGORIES.reduce<Record<string, BtpMateriau[]>>((acc, cat) => {
    acc[cat] = materiaux.filter((m) => m.category === cat)
    return acc
  }, {})

  // ── Onglet Chantiers ───────────────────────────────────────────────────────

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tous')
  const [showAddChantier, setShowAddChantier] = useState(false)
  const [expandedChantiers, setExpandedChantiers] = useState<Set<string>>(new Set())
  const [savingChantier, setSavingChantier] = useState(false)
  const [chantierForm, setChantierForm] = useState({
    client_name: '',
    client_phone: '',
    description: '',
    adresse: '',
    date_debut: '',
    date_fin_prevue: '',
    prix_total_fcfa: '',
    avance_versee_fcfa: '',
    notes: '',
  })

  const filteredChantiers = chantiers.filter((c) => {
    if (statusFilter === 'tous') return true
    if (statusFilter === 'en_cours') return c.status === 'en_cours'
    if (statusFilter === 'termine') return c.status === 'termine'
    return true
  })

  function toggleExpand(id: string) {
    setExpandedChantiers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAddChantier(e: React.FormEvent) {
    e.preventDefault()
    setSavingChantier(true)
    try {
      const res = await fetch('/api/btp/chantiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: chantierForm.client_name,
          client_phone: chantierForm.client_phone || null,
          description: chantierForm.description,
          adresse: chantierForm.adresse || null,
          date_debut: chantierForm.date_debut || null,
          date_fin_prevue: chantierForm.date_fin_prevue || null,
          prix_total_fcfa: parseInt(chantierForm.prix_total_fcfa, 10) || 0,
          avance_versee_fcfa: parseInt(chantierForm.avance_versee_fcfa, 10) || 0,
          notes: chantierForm.notes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? 'Erreur')
        return
      }
      const newChantier = await res.json() as BtpChantier
      setChantiers((prev) => [newChantier, ...prev])
      setChantierForm({
        client_name: '', client_phone: '', description: '',
        adresse: '', date_debut: '', date_fin_prevue: '',
        prix_total_fcfa: '', avance_versee_fcfa: '', notes: '',
      })
      setShowAddChantier(false)
      toast.success(t('merchant.btp.chantierCreated'))
    } finally {
      setSavingChantier(false)
    }
  }

  async function handleMarkTermine(id: string) {
    const res = await fetch(`/api/btp/chantiers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'termine' }),
    })
    if (!res.ok) { toast.error(t('merchant.btp.updateError')); return }
    const updated = await res.json() as BtpChantier
    setChantiers((prev) => prev.map((c) => (c.id === id ? updated : c)))
    toast.success(t('merchant.btp.markedTermine'))
  }

  async function handleDeleteChantier(id: string) {
    if (!confirm(t('merchant.btp.deleteChantierConfirm'))) return
    const res = await fetch(`/api/btp/chantiers/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error(t('merchant.btp.deleteError')); return }
    setChantiers((prev) => prev.filter((c) => c.id !== id))
    toast.success(t('merchant.btp.chantierDeleted'))
  }

  // ── Onglet Estimateur IA ──────────────────────────────────────────────────

  const [estPhase, setEstPhase] = useState<'input' | 'review'>('input')
  const [estDescription, setEstDescription] = useState('')
  const [estSurface, setEstSurface] = useState('')
  const [estPieces, setEstPieces] = useState('')
  const [estLoading, setEstLoading] = useState(false)
  const [aiItems, setAiItems] = useState<AiItem[]>([])
  const [attachChantier, setAttachChantier] = useState('')
  const [savingAttach, setSavingAttach] = useState(false)
  const [quoteTotal, setQuoteTotal] = useState(0)

  const totalMateriaux = aiItems.reduce((s, item) => s + item.quantity * item.price_per_unit_fcfa, 0)

  async function handleGenerateEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!estDescription.trim()) { toast.error(t('merchant.btp.descRequired')); return }
    setEstLoading(true)
    try {
      const res = await fetch('/api/btp/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: estDescription,
          surface: estSurface ? parseFloat(estSurface) : undefined,
          pieces: estPieces ? parseInt(estPieces, 10) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('merchant.btp.iaError'))
        return
      }
      const data = await res.json() as { items: Omit<AiItem, 'price_per_unit_fcfa'>[] }
      const items: AiItem[] = data.items.map((item) => ({
        ...item,
        price_per_unit_fcfa: 0,
      }))
      setAiItems(items)
      setQuoteTotal(0)
      setEstPhase('review')
    } finally {
      setEstLoading(false)
    }
  }

  function updateAiItem(index: number, field: keyof AiItem, value: string | number) {
    setAiItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  function removeAiItem(index: number) {
    setAiItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addAiItem() {
    setAiItems((prev) => [
      ...prev,
      { name: '', unit: 'pièce', quantity: 1, category: 'autre', price_per_unit_fcfa: 0 },
    ])
  }

  async function handleAttachToChantier() {
    if (!attachChantier) { toast.error(t('merchant.btp.noChantierSelected')); return }
    setSavingAttach(true)
    try {
      const res = await fetch(`/api/btp/chantiers/${attachChantier}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materiaux: aiItems.map((item) => ({
            nom_materiau: item.name,
            unit: item.unit,
            quantity_needed: item.quantity,
            price_per_unit_fcfa: item.price_per_unit_fcfa,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? 'Erreur')
        return
      }
      const updated = await res.json() as BtpChantier
      setChantiers((prev) => prev.map((c) => (c.id === attachChantier ? updated : c)))
      toast.success(t('merchant.btp.attachSuccess'))
      setAttachChantier('')
    } finally {
      setSavingAttach(false)
    }
  }

  function handlePrintDevis() {
    const seq = parseInt(localStorage.getItem('gf_btp_devis_seq') ?? '0', 10) + 1
    localStorage.setItem('gf_btp_devis_seq', String(seq))
    const devisNum = `BTP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
    const today = new Date().toLocaleDateString(undefined, {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const rows = aiItems.map((item) => `
      <tr>
        <td>${item.name}${item.note ? `<br><small style="color:#666">${item.note}</small>` : ''}</td>
        <td style="text-align:center">${item.unit}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${item.price_per_unit_fcfa.toLocaleString()} FCFA</td>
        <td style="text-align:right">${(item.quantity * item.price_per_unit_fcfa).toLocaleString()} FCFA</td>
      </tr>
    `).join('')

    const totalDisplay = quoteTotal > 0
      ? `${quoteTotal.toLocaleString()} FCFA`
      : '_____ FCFA'

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${t('merchant.btp.printDevisBtn')} ${devisNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
  .page { padding: 30px 35px; max-width: 800px; margin: auto; }
  h1 { font-size: 22px; }
  h2 { font-size: 15px; margin: 18px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .header-left h1 { color: #16a34a; }
  .header-right { text-align: right; }
  .header-right .devis-title { font-size: 18px; font-weight: bold; color: #333; }
  .header-right .devis-num { font-size: 13px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f3f4f6; padding: 7px 8px; text-align: left; font-size: 12px; border: 1px solid #e5e7eb; }
  td { padding: 6px 8px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 12px; }
  .totals-table { margin-top: 16px; margin-left: auto; width: 320px; }
  .totals-table td { border: none; padding: 4px 8px; }
  .total-box { border: 2px solid #16a34a; border-radius: 6px; padding: 10px 14px; margin-top: 12px; text-align: right; }
  .total-box .label { font-size: 14px; font-weight: bold; color: #333; }
  .total-box .amount { font-size: 20px; font-weight: bold; color: #16a34a; margin-top: 4px; }
  .validity { margin-top: 14px; font-size: 11px; color: #666; }
  .payment { margin-top: 6px; font-size: 11px; color: #666; }
  .sigs { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 44%; }
  .sig-box .sig-label { font-weight: bold; font-size: 12px; margin-bottom: 40px; }
  .sig-line { border-top: 1px solid #555; }
  @media print { .page-break { page-break-before: always; } }
  .internal-banner { background: #fef3c7; border: 1px solid #fbbf24; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; color: #92400e; }
</style>
</head>
<body>

<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>🔥 ${businessName}</h1>
    </div>
    <div class="header-right">
      <div class="devis-title">DEVIS DE TRAVAUX</div>
      <div class="devis-num">N° ${devisNum} — ${today}</div>
    </div>
  </div>

  <h2>${t('merchant.btp.chantierDesc').replace(' *', '')}</h2>
  <p style="font-style:italic; color:#444; margin-top:4px">${estDescription}</p>

  <h2>${t('merchant.btp.tabMateriaux')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('merchant.btp.tableDescHeader')}</th>
        <th style="text-align:center">${t('merchant.btp.tableUnitHeader')}</th>
        <th style="text-align:center">${t('merchant.btp.tableQtyHeader')}</th>
        <th style="text-align:right">${t('merchant.btp.tablePUHeader')}</th>
        <th style="text-align:right">${t('merchant.btp.tableTotalHeader')}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td style="color:#555">${t('merchant.btp.totalMatLabel')}</td>
      <td style="text-align:right; font-weight:bold">${totalMateriaux.toLocaleString()} FCFA</td>
    </tr>
    <tr>
      <td style="color:#555">Main d'œuvre</td>
      <td style="text-align:right">_____ FCFA</td>
    </tr>
  </table>

  <div class="total-box">
    <div class="label">TOTAL DEVIS</div>
    <div class="amount">${totalDisplay}</div>
  </div>

  <p class="validity">Devis valable 30 jours à compter de la date d'émission.</p>
  <p class="payment">Conditions de paiement : Acompte de 30% à la signature · Solde à la livraison des travaux.</p>

  <div class="sigs">
    <div class="sig-box">
      <div class="sig-label">L'artisan :</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-box" style="text-align:right">
      <div class="sig-label">Le client, lu et approuvé :</div>
      <div class="sig-line"></div>
    </div>
  </div>
</div>

<div class="page page-break">
  <div class="internal-banner">
    ⚠️ Cette page est à usage interne — ne pas remettre au client
  </div>
  <div style="margin-bottom:16px">
    <strong style="font-size:16px">LISTE DE MATÉRIAUX — Usage interne</strong><br>
    <span style="color:#666; font-size:12px">${estDescription}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t('merchant.btp.tableDescHeader')}</th>
        <th style="text-align:center">${t('merchant.btp.tableUnitHeader')}</th>
        <th style="text-align:center">${t('merchant.btp.tableQtyHeader')}</th>
        <th style="text-align:right">${t('merchant.btp.tablePUHeader')}</th>
        <th style="text-align:right">${t('merchant.btp.tableTotalHeader')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#f0fdf4; font-weight:bold">
        <td colspan="4" style="text-align:right">${t('merchant.btp.totalMatLabel')}</td>
        <td style="text-align:right">${totalMateriaux.toLocaleString()} FCFA</td>
      </tr>
    </tbody>
  </table>
</div>

<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.btp.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{businessName}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.btp.backToTools')}</Link>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['materiaux', 'chantiers', 'estimateur'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === tabKey
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ── TAB MATÉRIAUX ─────────────────────────────────────────────────── */}
      {tab === 'materiaux' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.btp.materiauxTitle')}</h2>
            <button
              onClick={() => setShowAddMateriau((v) => !v)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {t('merchant.btp.addBtn')}
            </button>
          </div>

          {/* Formulaire ajout */}
          {showAddMateriau && (
            <form onSubmit={handleAddMateriau} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-sm text-gray-800">{t('merchant.btp.newMatTitle')}</p>
              <div>
                <label className="label">{t('merchant.btp.matName')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.btp.matNamePlaceholder')}
                  value={matForm.name}
                  onChange={(e) => setMatForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.btp.matCategory')}</label>
                  <select
                    className="input"
                    value={matForm.category}
                    onChange={(e) => setMatForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CAT_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('merchant.btp.matUnit')}</label>
                  <select
                    className="input"
                    value={matForm.unit}
                    onChange={(e) => setMatForm((f) => ({ ...f, unit: e.target.value }))}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.btp.matPrice').replace('{unit}', matForm.unit)}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="Ex: 4200"
                  value={matForm.price_per_unit_fcfa}
                  onChange={(e) => setMatForm((f) => ({ ...f, price_per_unit_fcfa: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingMat} className="btn-primary text-sm py-2 flex-1">
                  {savingMat ? '...' : t('merchant.btp.addMatBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMateriau(false)}
                  className="text-sm py-2 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Liste groupée par catégorie */}
          {materiaux.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-3">🧱</p>
              <p className="text-sm font-medium">{t('merchant.btp.materiauxEmpty')}</p>
              <p className="text-xs mt-1">{t('merchant.btp.materiauxEmptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const items = materiauxByCategory[cat]
                if (!items || items.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {CAT_LABELS[cat]}
                    </p>
                    <div className="card divide-y divide-gray-50 !p-0 overflow-hidden">
                      {items.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{m.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatFcfa(m.price_per_unit_fcfa)}/{m.unit}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteMateriau(m.id)}
                            className="text-red-400 hover:text-red-600 text-xs px-2 py-1"
                          >
                            {t('merchant.btp.deleteMat')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CHANTIERS ─────────────────────────────────────────────────── */}
      {tab === 'chantiers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.btp.chantiersTitle')}</h2>
            <button
              onClick={() => setShowAddChantier((v) => !v)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {t('merchant.btp.addChantier')}
            </button>
          </div>

          {/* Filtre statut */}
          <div className="flex gap-1">
            {(['tous', 'en_cours', 'termine'] as StatusFilter[]).map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setStatusFilter(statusKey)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === statusKey
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {FILTER_LABELS[statusKey]}
              </button>
            ))}
          </div>

          {/* Formulaire nouveau chantier */}
          {showAddChantier && (
            <form onSubmit={handleAddChantier} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-sm text-gray-800">{t('merchant.btp.newChantierTitle')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.btp.chantierClientName')}</label>
                  <input
                    className="input"
                    placeholder={t('merchant.btp.chantierClientPlaceholder')}
                    value={chantierForm.client_name}
                    onChange={(e) => setChantierForm((f) => ({ ...f, client_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <PhoneInput
                    value={chantierForm.client_phone}
                    onChange={(v) => setChantierForm((f) => ({ ...f, client_phone: v }))}
                    placeholder="97 00 00 00"
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.btp.chantierDesc')}</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder={t('merchant.btp.chantierDescPlaceholder')}
                  value={chantierForm.description}
                  onChange={(e) => setChantierForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">{t('merchant.btp.chantierAddress')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.btp.chantierAddressPlaceholder')}
                  value={chantierForm.adresse}
                  onChange={(e) => setChantierForm((f) => ({ ...f, adresse: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.btp.chantierStart')}</label>
                  <input
                    className="input"
                    type="date"
                    value={chantierForm.date_debut}
                    onChange={(e) => setChantierForm((f) => ({ ...f, date_debut: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.btp.chantierEnd')}</label>
                  <input
                    className="input"
                    type="date"
                    value={chantierForm.date_fin_prevue}
                    onChange={(e) => setChantierForm((f) => ({ ...f, date_fin_prevue: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.btp.chantierTotal')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="500000"
                    value={chantierForm.prix_total_fcfa}
                    onChange={(e) => setChantierForm((f) => ({ ...f, prix_total_fcfa: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.btp.chantierAdvance')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="150000"
                    value={chantierForm.avance_versee_fcfa}
                    onChange={(e) => setChantierForm((f) => ({ ...f, avance_versee_fcfa: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.btp.chantierNotes')}</label>
                <textarea
                  className="input"
                  placeholder={t('merchant.btp.chantierNotesPlaceholder')}
                  value={chantierForm.notes}
                  onChange={(e) => setChantierForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                {t('merchant.btp.estimateurTabHint')}
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={savingChantier} className="btn-primary text-sm py-2 flex-1">
                  {savingChantier ? t('merchant.btp.creating') : t('merchant.btp.createChantierBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddChantier(false)}
                  className="text-sm py-2 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Liste chantiers */}
          {filteredChantiers.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm font-medium">{t('merchant.btp.chantiersEmpty')}</p>
              <p className="text-xs mt-1">{t('merchant.btp.chantiersEmptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChantiers.map((chantier) => {
                const coutMat = calcChantierCoutMateriaux(chantier)
                const solde = calcSolde(chantier)
                const isExpanded = expandedChantiers.has(chantier.id)
                return (
                  <div key={chantier.id} className="card space-y-3">
                    {/* En-tête chantier */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{chantier.client_name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            chantier.status === 'en_cours'
                              ? 'bg-blue-100 text-blue-700'
                              : chantier.status === 'termine'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {STATUS_LABELS[chantier.status]}
                          </span>
                        </div>
                        {chantier.client_phone && (
                          <p className="text-xs text-gray-400 mt-0.5">{chantier.client_phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 italic">{chantier.description}</p>

                    {/* Adresse + dates */}
                    {(chantier.adresse || chantier.date_debut) && (
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {chantier.adresse && <span>📍 {chantier.adresse}</span>}
                        {chantier.date_debut && <span>📅 {fmtDate(chantier.date_debut)}</span>}
                        {chantier.date_fin_prevue && <span>→ {fmtDate(chantier.date_fin_prevue)}</span>}
                      </div>
                    )}

                    {/* Financier */}
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <p className="text-xs text-gray-500">
                        {t('merchant.btp.matEstimated')} <span className="font-medium text-gray-700">{formatFcfa(coutMat)}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <span>{t('merchant.btp.totalConvenu')} <strong>{formatFcfa(chantier.prix_total_fcfa)}</strong></span>
                        <span>{t('merchant.btp.avance')} <strong>{formatFcfa(chantier.avance_versee_fcfa)}</strong></span>
                        <span>
                          {t('merchant.btp.solde')}{' '}
                          <strong className={solde > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatFcfa(solde)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {chantier.status === 'en_cours' && (
                        <button
                          onClick={() => handleMarkTermine(chantier.id)}
                          className="text-xs py-1.5 px-3 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                        >
                          {t('merchant.btp.markTermineBtn')}
                        </button>
                      )}
                      {chantier.btp_chantier_materiaux.length > 0 && (
                        <button
                          onClick={() => toggleExpand(chantier.id)}
                          className="text-xs py-1.5 px-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
                        >
                          {isExpanded
                            ? t('merchant.btp.hideMat')
                            : t('merchant.btp.showMat').replace('{n}', String(chantier.btp_chantier_materiaux.length))}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteChantier(chantier.id)}
                        className="text-xs py-1.5 px-3 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100"
                      >
                        Supprimer
                      </button>
                    </div>

                    {/* Liste matériaux (dépliable) */}
                    {isExpanded && chantier.btp_chantier_materiaux.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left py-2 px-3 border border-gray-100 font-medium text-gray-500">{t('merchant.btp.tableMatHeader')}</th>
                              <th className="text-center py-2 px-3 border border-gray-100 font-medium text-gray-500">{t('merchant.btp.tableQtyHeader')}</th>
                              <th className="text-center py-2 px-3 border border-gray-100 font-medium text-gray-500">{t('merchant.btp.tableUnitHeader')}</th>
                              <th className="text-right py-2 px-3 border border-gray-100 font-medium text-gray-500">{t('merchant.btp.tablePUHeader')}</th>
                              <th className="text-right py-2 px-3 border border-gray-100 font-medium text-gray-500">{t('merchant.btp.tableTotalHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chantier.btp_chantier_materiaux.map((m) => (
                              <tr key={m.id} className="border-b border-gray-50">
                                <td className="py-2 px-3 border border-gray-100">{m.nom_materiau}</td>
                                <td className="py-2 px-3 border border-gray-100 text-center">{m.quantity_needed}</td>
                                <td className="py-2 px-3 border border-gray-100 text-center">{m.unit}</td>
                                <td className="py-2 px-3 border border-gray-100 text-right">{formatFcfa(m.price_per_unit_fcfa)}</td>
                                <td className="py-2 px-3 border border-gray-100 text-right font-medium">
                                  {formatFcfa(m.quantity_needed * m.price_per_unit_fcfa)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB ESTIMATEUR IA ──────────────────────────────────────────────── */}
      {tab === 'estimateur' && (
        <div className="space-y-4">

          {/* PHASE A — saisie */}
          {estPhase === 'input' && (
            <form onSubmit={handleGenerateEstimate} className="space-y-4">
              <div className="text-center py-2">
                <p className="text-2xl">🤖</p>
                <h2 className="font-bold text-lg text-gray-900 mt-1">{t('merchant.btp.estimateurTitle')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('merchant.btp.estimateurSubtitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('merchant.btp.estimateurHint')}</p>
              </div>

              <div>
                <label className="label">{t('merchant.btp.chantierDesc')}</label>
                <textarea
                  className="input min-h-[100px]"
                  rows={4}
                  placeholder="Ex: Carrelage de 25m² en sol avec carreaux 40×40, pose de faïence murale dans une salle de bain, installation électrique standard pour un appartement de 3 pièces..."
                  value={estDescription}
                  onChange={(e) => setEstDescription(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.btp.surface')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Ex: 25"
                    value={estSurface}
                    onChange={(e) => setEstSurface(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.btp.pieces')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Ex: 3"
                    value={estPieces}
                    onChange={(e) => setEstPieces(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={estLoading}
                className="btn-primary w-full py-3 text-base font-semibold"
              >
                {estLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {t('merchant.btp.analyzing')}
                  </span>
                ) : (
                  t('merchant.btp.generateBtn')
                )}
              </button>
            </form>
          )}

          {/* PHASE B — révision */}
          {estPhase === 'review' && (
            <div className="space-y-4">
              {/* Bannière succès */}
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✅</span>
                <p className="text-sm text-green-800">{t('merchant.btp.estimateReady')}</p>
              </div>

              {/* Hint prix manquants */}
              {aiItems.some((item) => item.price_per_unit_fcfa === 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  💡 {t('merchant.btp.missingPrices')}
                </div>
              )}

              {/* Tableau éditable */}
              <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-medium text-gray-500">{t('merchant.btp.tableDescHeader')}</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-500">{t('merchant.btp.tableQtyHeader')}</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-500">{t('merchant.btp.tableUnitHeader')}</th>
                        <th className="text-right px-2 py-2 font-medium text-gray-500">{t('merchant.btp.tablePriceHeader')}</th>
                        <th className="text-right px-2 py-2 font-medium text-gray-500">{t('merchant.btp.tableTotalHeader')}</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {aiItems.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full border-0 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-300 rounded px-1 py-0.5"
                              value={item.name}
                              onChange={(e) => updateAiItem(i, 'name', e.target.value)}
                            />
                            {item.note && (
                              <p className="text-[10px] text-gray-400 px-1 mt-0.5">{item.note}</p>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              className="w-16 border border-gray-200 rounded text-center text-xs px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-300"
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.quantity}
                              onChange={(e) => updateAiItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <select
                              className="border border-gray-200 rounded text-xs px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-300"
                              value={item.unit}
                              onChange={(e) => updateAiItem(i, 'unit', e.target.value)}
                            >
                              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              className={`w-24 border rounded text-right text-xs px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-300 ${
                                item.price_per_unit_fcfa === 0
                                  ? 'border-amber-300 bg-amber-50'
                                  : 'border-gray-200'
                              }`}
                              type="number"
                              min="0"
                              value={item.price_per_unit_fcfa}
                              onChange={(e) => updateAiItem(i, 'price_per_unit_fcfa', parseInt(e.target.value, 10) || 0)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-700">
                            {(item.quantity * item.price_per_unit_fcfa).toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeAiItem(i)}
                              className="text-red-400 hover:text-red-600 font-bold text-sm leading-none"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={addAiItem}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    {t('merchant.docs.addLine')}
                  </button>
                </div>
              </div>

              {/* Barre totale */}
              <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{t('merchant.btp.totalMatLabel')}</p>
                <p className="text-lg font-bold text-brand-700">{formatFcfa(totalMateriaux)}</p>
              </div>

              {/* Prix total du devis */}
              <div>
                <label className="label">{t('merchant.btp.quoteTotalLabel')}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder={`Ex: ${totalMateriaux * 2 > 0 ? (totalMateriaux * 2).toLocaleString() : '0'}`}
                  value={quoteTotal === 0 ? '' : quoteTotal}
                  onChange={(e) => setQuoteTotal(parseInt(e.target.value, 10) || 0)}
                />
                <p className="text-xs text-gray-400 mt-1">{t('merchant.btp.quoteTotalHint')}</p>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handlePrintDevis}
                  className="btn-primary w-full py-3 text-sm font-semibold"
                >
                  {t('merchant.btp.printDevisBtn')}
                </button>

                <div className="card space-y-3 !py-3">
                  <p className="text-xs font-semibold text-gray-700">{t('merchant.btp.attachTitle')}</p>
                  <div className="flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={attachChantier}
                      onChange={(e) => setAttachChantier(e.target.value)}
                    >
                      <option value="">{t('merchant.btp.attachPlaceholder')}</option>
                      {chantiers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client_name} — {c.description.slice(0, 40)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAttachToChantier}
                      disabled={savingAttach || !attachChantier}
                      className="btn-primary text-sm py-2 px-4 whitespace-nowrap disabled:opacity-40"
                    >
                      {savingAttach ? '...' : t('merchant.btp.attachBtn')}
                    </button>
                  </div>
                  {chantiers.length === 0 && (
                    <p className="text-xs text-gray-400">{t('merchant.btp.noChantierYet')}</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setEstPhase('input')
                    setAiItems([])
                    setEstDescription('')
                    setEstSurface('')
                    setEstPieces('')
                    setQuoteTotal(0)
                  }}
                  className="w-full text-sm py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  {t('merchant.btp.restart')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
