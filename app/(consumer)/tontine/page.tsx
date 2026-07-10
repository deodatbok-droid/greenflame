'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

type DeliveryStatus = 'en_attente' | 'prepare' | 'livre' | 'annule'

type DeliveryOrder = {
  id: string
  tontine_id: string
  membre_id: string
  cycle_number: number
  status: DeliveryStatus
  notified_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
}

type TontineProduct = {
  id: string
  tontine_id: string
  product_id: string
  merchant_id: string
  product_name: string
  unit_price_fcfa: number
  validated_at: string | null
  stock_committed: boolean
  tontine_delivery_orders: DeliveryOrder[]
}

type Frequency = 'hebdomadaire' | 'bimensuel' | 'mensuel'
type TontineStatus = 'actif' | 'pause' | 'termine'
type CotisationStatus = 'paye' | 'partiel' | 'en_retard' | 'en_attente'
type MembreStatus = 'pending' | 'active' | 'expired'

type Cotisation = {
  id: string
  membre_id: string
  periode: string
  amount_fcfa: number
  late_fee_fcfa: number
  status: CotisationStatus
  paid_at: string | null
  notes: string | null
}

type Membre = {
  id: string
  tontine_id: string
  user_id: string | null
  full_name: string
  phone: string | null
  position: number
  has_received_pot: boolean
  is_admin: boolean
  joined_at: string
  status: MembreStatus
  invite_expires_at: string | null
  tontine_cotisations: Cotisation[]
}

type Tontine = {
  id: string
  creator_id: string
  name: string
  description: string | null
  contribution_amount_fcfa: number
  frequency: Frequency
  start_date: string
  status: TontineStatus
  share_token: string
  notes: string | null
  created_at: string
  type: 'cash' | 'produit'
  tontine_membres: Membre[]
  tontine_product?: TontineProduct | null
}


const STATUS_CYCLE: CotisationStatus[] = ['en_attente', 'paye', 'partiel', 'en_retard']

function nextStatus(current: CotisationStatus): CotisationStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

function getCurrentPeriode(frequency: Frequency): string {
  const now = new Date()
  if (frequency === 'hebdomadaire') {
    const onejan = new Date(now.getFullYear(), 0, 1)
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodeLabel(periode: string, locale: string): string {
  if (periode.includes('-W')) {
    const [y, w] = periode.split('-W')
    return `${locale === 'en' ? 'Week' : 'Semaine'} ${parseInt(w, 10)} · ${y}`
  }
  const [y, m] = periode.split('-')
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
}

export default function TontinePage() {
  const router = useRouter()
  const { t, locale } = useLocale()

  const TONTINE_STATUS_CONFIG: Record<TontineStatus, { label: string; classes: string }> = {
    actif:   { label: t('tontine.statusActive'), classes: 'bg-green-50 text-green-700 border-green-200' },
    pause:   { label: t('tontine.statusPause'),  classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    termine: { label: t('tontine.statusDone'),   classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  }

  const COTISATION_STATUS_CONFIG: Record<CotisationStatus, { label: string; icon: string; classes: string }> = {
    paye:       { label: t('tontine.cotPaid'),     icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
    partiel:    { label: t('tontine.cotPartial'),  icon: '🟡', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    en_retard:  { label: t('tontine.cotLate'),     icon: '🔴', classes: 'bg-red-50 text-red-600 border-red-200' },
    en_attente: { label: t('tontine.cotPending'),  icon: '⏳', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  }

  const MEMBRE_STATUS_CONFIG: Record<'pending' | 'expired', { label: string; classes: string }> = {
    pending: { label: t('tontine.memberStatusPending'), classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    expired: { label: t('tontine.memberStatusExpired'), classes: 'bg-red-50 text-red-600 border-red-200' },
  }

  function effectiveMembreStatus(m: Membre): MembreStatus {
    if (m.status === 'expired') return 'expired'
    if (m.status === 'pending' && m.invite_expires_at && new Date(m.invite_expires_at) < new Date()) return 'expired'
    return m.status ?? 'active'
  }

  const FREQUENCY_LABELS: Record<Frequency, string> = {
    hebdomadaire: t('tontine.frequencyWeekly'),
    bimensuel:    t('tontine.frequencyBimonthly'),
    mensuel:      t('tontine.frequencyMonthly'),
  }

  const [tontines, setTontines] = useState<Tontine[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'apercu' | 'cotisations' | 'membres'>('apercu')
  const [copied, setCopied] = useState(false)
  const [openingDiscussion, setOpeningDiscussion] = useState(false)

  // ── Mode produit (initié depuis la marketplace) ──
  const [productMode, setProductMode] = useState<{
    product_id: string; merchant_id: string; price: number; product_name: string
  } | null>(null)
  const [nbParticipants, setNbParticipants] = useState(5)

  // ── Création ──
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', contribution_amount_fcfa: '',
    frequency: 'mensuel' as Frequency, start_date: '', notes: '',
  })
  const [membresForm, setMembresForm] = useState<{ full_name: string; phone: string }[]>([
    { full_name: '', phone: '' },
  ])

  // Lecture des paramètres URL (produit marketplace) au montage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('product_id')
    const mid = params.get('merchant_id')
    const price = params.get('price')
    const pname = params.get('product_name')
    if (pid && mid && price && pname) {
      const p = parseInt(price, 10)
      const n = 5
      setProductMode({ product_id: pid, merchant_id: mid, price: p, product_name: pname })
      setNbParticipants(n)
      setForm(f => ({
        ...f,
        name: `Tontine — ${pname}`,
        contribution_amount_fcfa: String(Math.ceil(p / n)),
      }))
      setShowCreate(true)
    }
  }, [])

  // ── Cotisations ──
  const [periode, setPeriode] = useState('')
  const [savingCotisation, setSavingCotisation] = useState<string | null>(null)

  // ── Ajout de membre dans le détail ──
  const [showAddMembre, setShowAddMembre] = useState(false)
  const [newMembre, setNewMembre] = useState({ full_name: '', phone: '' })
  const [savingMembre, setSavingMembre] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tontines')
      const data = await res.json()
      if (res.ok) {
        const tontines = data as Tontine[]
        // Charger les overlays produit pour les tontines de type produit
        const withProducts = await Promise.all(
          tontines.map(async (t) => {
            if (t.type !== 'produit') return t
            try {
              const pRes = await fetch(`/api/tontines/${t.id}/product`)
              const pData = pRes.ok ? await pRes.json() : null
              return { ...t, tontine_product: pData }
            } catch {
              return t
            }
          })
        )
        setTontines(withProducts)
      }
    } catch {
      // silencieux — réseau
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selected = tontines.find(ton => ton.id === selectedId) ?? null

  useEffect(() => {
    if (selected) setPeriode(getCurrentPeriode(selected.frequency))
  }, [selected?.id, selected?.frequency])

  function openDetail(id: string) {
    setSelectedId(id)
    setDetailTab('apercu')
    setShowAddMembre(false)
  }

  function backToList() {
    setSelectedId(null)
  }

  // ── Formulaire de création ──
  function addMembreRow() {
    setMembresForm(prev => [...prev, { full_name: '', phone: '' }])
  }
  function removeMembreRow(index: number) {
    setMembresForm(prev => prev.filter((_, i) => i !== index))
  }
  function updateMembreRow(index: number, field: 'full_name' | 'phone', value: string) {
    setMembresForm(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }
  function resetCreateForm() {
    setShowCreate(false)
    setProductMode(null)
    setNbParticipants(5)
    setForm({ name: '', description: '', contribution_amount_fcfa: '', frequency: 'mensuel', start_date: '', notes: '' })
    setMembresForm([{ full_name: '', phone: '' }])
  }

  const contributionNum = parseInt(form.contribution_amount_fcfa.replace(/\D/g, '')) || 0
  const validMembres = membresForm.filter(m => m.full_name.trim().length > 0)

  async function handleCreate() {
    if (!form.name.trim()) { toast.error(t('tontine.errorNameRequired')); return }
    if (contributionNum <= 0) { toast.error(t('tontine.errorAmountRequired')); return }
    if (validMembres.length === 0) { toast.error(t('tontine.errorMemberRequired')); return }

    setCreating(true)
    try {
      const res = await fetch('/api/tontines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          contribution_amount_fcfa: contributionNum,
          frequency: form.frequency,
          start_date: form.start_date || undefined,
          notes: form.notes.trim() || null,
          type: productMode ? 'produit' : 'cash',
          membres: validMembres.map((m, i) => ({ full_name: m.full_name.trim(), phone: m.phone.trim() || undefined, position: i + 1 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))

      // Si mode produit : attacher l'overlay produit
      if (productMode) {
        const pRes = await fetch(`/api/tontines/${data.id}/product`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productMode.product_id,
            merchant_id: productMode.merchant_id,
            product_name: productMode.product_name,
            unit_price_fcfa: productMode.price,
          }),
        })
        if (!pRes.ok) {
          // Non bloquant : la tontine est créée, l'overlay sera retenté plus tard
          toast(t('tontine.produitLinkError'), { icon: '⚠️' })
        } else {
          toast.success(t('tontine.produitCreated'))
        }
      } else {
        toast.success(t('tontine.created'))
      }

      resetCreateForm()
      await load()
      setSelectedId(data.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(tontineId: string, status: TontineStatus) {
    try {
      const res = await fetch(`/api/tontines/${tontineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      toast.success(t('tontine.statusUpdated'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    }
  }

  function copyShareLink(token: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://greenflame.africa'
    const url = `${origin}/tontine/public/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast.success(t('profile.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareLink(tontine: Tontine) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://greenflame.africa'
    const url = `${origin}/tontine/public/${tontine.share_token}`
    const text = t('tontine.shareText')
      .replace('{name}', tontine.name)
      .replace('{amount}', formatFcfa(tontine.contribution_amount_fcfa))
      .replace('{freq}', FREQUENCY_LABELS[tontine.frequency].toLowerCase())
      .replace('{url}', url)
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      toast.success(t('profile.linkCopied'))
    }
  }

  async function openDiscussion(tontineId: string) {
    if (openingDiscussion) return
    setOpeningDiscussion(true)
    try {
      const res = await fetch(`/api/messages/conversations/tontine/${tontineId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      router.push(`/messages/${data.conversationId}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
      setOpeningDiscussion(false)
    }
  }

  // ── Membres (détail) ──
  async function handleAddMembre() {
    if (!selected) return
    if (!newMembre.full_name.trim()) { toast.error(t('tontine.errorMemberNameRequired')); return }

    setSavingMembre(true)
    try {
      const res = await fetch(`/api/tontines/${selected.id}/membres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newMembre.full_name.trim(), phone: newMembre.phone.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      toast.success(t('tontine.memberAdded'))
      setNewMembre({ full_name: '', phone: '' })
      setShowAddMembre(false)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingMembre(false)
    }
  }

  async function toggleReceivedPot(membre: Membre) {
    if (!selected) return
    try {
      const res = await fetch(`/api/tontines/${selected.id}/membres/${membre.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_received_pot: !membre.has_received_pot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function resendInvite(membre: Membre) {
    if (!selected) return
    if (!membre.phone) { toast.error(t('tontine.resendNoPhone')); return }
    setResendingId(membre.id)
    try {
      const res = await fetch(`/api/tontines/${selected.id}/membres/${membre.id}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('tontine.resendError'))
      toast.success(t('tontine.resendSuccess'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('tontine.resendError'))
    } finally {
      setResendingId(null)
    }
  }

  async function removeMembre(membreId: string) {
    if (!selected) return
    if (!confirm(t('tontine.removeMemberConfirm'))) return
    try {
      const res = await fetch(`/api/tontines/${selected.id}/membres/${membreId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      toast.success(t('tontine.memberRemoved'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    }
  }

  // ── Cotisations (détail) ──
  function findCotisation(membre: Membre): Cotisation | undefined {
    return membre.tontine_cotisations.find(c => c.periode === periode)
  }

  async function cycleCotisation(membre: Membre) {
    if (!selected) return
    const existing = findCotisation(membre)
    setSavingCotisation(membre.id)
    try {
      if (!existing) {
        const res = await fetch(`/api/tontines/${selected.id}/cotisations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membre_id: membre.id,
            periode,
            amount_fcfa: selected.contribution_amount_fcfa,
            status: 'paye',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? t('common.error'))
      } else {
        const res = await fetch(`/api/tontines/${selected.id}/cotisations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: existing.id, status: nextStatus(existing.status) }] }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? t('common.error'))
      }
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingCotisation(null)
    }
  }

  // ── Rendu ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => selected ? backToList() : router.back()}
            className="text-brand-200 text-sm hover:text-white flex items-center gap-1"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" /></svg>
            {t('common.back')}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🤝</span>
          <div>
            <h1 className="font-bold text-xl leading-none">
              {selected ? selected.name : t('tontine.title')}
            </h1>
            <p className="text-brand-200 text-sm mt-0.5">
              {selected ? `${t('tontine.amount')} ${formatFcfa(selected.contribution_amount_fcfa)} FCFA · ${FREQUENCY_LABELS[selected.frequency]}` : t('tontine.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════ VUE LISTE ═══════════════ */}
      {!selected && (
        <>
          <div className="card bg-amber-50 border-amber-200">
            <h2 className="font-semibold text-amber-800 text-sm mb-2">{t('tontine.howItWorks')}</h2>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>{t('tontine.howStep1')}</li>
              <li>{t('tontine.howStep2')}</li>
              <li>{t('tontine.howStep3')}</li>
              <li>{t('tontine.howStep4')}</li>
            </ol>
          </div>

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <span className="text-xl">+</span>
              {t('tontine.createTontine')}
            </button>
          ) : (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">
                  {productMode ? t('tontine.produitMode') : t('tontine.newTontine')}
                </h2>
                <button onClick={resetCreateForm} className="text-gray-400 hover:text-gray-600 text-xl font-medium">×</button>
              </div>

              {/* Bannière produit si initié depuis la marketplace */}
              {productMode && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛒</span>
                    <div>
                      <p className="font-semibold text-brand-900 text-sm">{productMode.product_name}</p>
                      <p className="text-xs text-brand-600">{formatFcfa(productMode.price)} FCFA</p>
                    </div>
                  </div>
                  <div>
                    <label className="label !mb-1 text-brand-800">{t('tontine.nbParticipants')}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={2} max={20} value={nbParticipants}
                        onChange={e => {
                          const n = parseInt(e.target.value, 10)
                          setNbParticipants(n)
                          setForm(f => ({ ...f, contribution_amount_fcfa: String(Math.ceil(productMode.price / n)) }))
                        }}
                        className="flex-1 accent-brand-600"
                      />
                      <span className="text-brand-700 font-bold w-6 text-center">{nbParticipants}</span>
                    </div>
                    <p className="text-xs text-brand-600 mt-1">
                      {t('tontine.cotisationParCycleLabel')} : <strong>{formatFcfa(Math.ceil(productMode.price / nbParticipants))} FCFA</strong> {t('tontine.perParticipant')}
                    </p>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t('tontine.merchantNotifHint')}
                  </p>
                </div>
              )}

              <div>
                <label className="label">{t('tontine.groupName')} <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : Tontine des amies du marché"
                  className="input" maxLength={80}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('tontine.amount')} <span className="text-red-500">*</span></label>
                  <input
                    type="number" inputMode="numeric" value={form.contribution_amount_fcfa}
                    onChange={e => setForm(f => ({ ...f, contribution_amount_fcfa: e.target.value }))}
                    placeholder="Ex : 5000" className="input"
                  />
                </div>
                <div>
                  <label className="label">{t('tontine.frequency')}</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency }))}
                    className="input"
                  >
                    <option value="hebdomadaire">{t('tontine.frequencyWeekly')}</option>
                    <option value="bimensuel">{t('tontine.frequencyBimonthly')}</option>
                    <option value="mensuel">{t('tontine.frequencyMonthly')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">{t('tontine.start')}</label>
                <input
                  type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t('tontine.descriptionOptional')}</label>
                <input
                  type="text" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex : Tontine mensuelle entre collègues du marché Dantokpa"
                  className="input" maxLength={160}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0">{t('tontine.members')} <span className="text-red-500">*</span></label>
                  <button onClick={addMembreRow} className="text-xs font-semibold text-brand-600 hover:text-brand-700">+ {t('tontine.addMember')}</button>
                </div>
                <p className="text-xs text-gray-400 mb-2">{t('tontine.firstMemberHint')}</p>
                <div className="space-y-2">
                  {membresForm.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <input
                        type="text" value={m.full_name}
                        onChange={e => updateMembreRow(i, 'full_name', e.target.value)}
                        placeholder="Nom complet" className="input flex-1"
                      />
                      <PhoneInput
                        value={m.phone}
                        onChange={v => updateMembreRow(i, 'phone', v)}
                        placeholder="Téléphone (optionnel)"
                      />
                      {membresForm.length > 1 && (
                        <button onClick={() => removeMembreRow(i)} className="text-gray-300 hover:text-red-500 text-lg flex-shrink-0">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {contributionNum > 0 && validMembres.length > 0 && (
                <div className="bg-brand-50 rounded-xl p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('tontine.potPerRound')}</span>
                    <span className="font-semibold text-brand-700">{formatFcfa(contributionNum * validMembres.length)} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('tontine.members')}</span>
                    <span className="font-semibold text-gray-800">{validMembres.length}</span>
                  </div>
                </div>
              )}

              <button onClick={handleCreate} disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? t('tontine.creating') : t('tontine.createAction')}
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-10 text-gray-400">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">{t('common.loading')}</p>
            </div>
          )}

          {!loading && tontines.length === 0 && (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-4xl mb-3">🤝</p>
              <p className="font-medium text-gray-600">{t('tontine.noTontine')}</p>
              <p className="text-xs mt-1">{t('tontine.noTontineHint')}</p>
            </div>
          )}

          {!loading && tontines.length > 0 && (
            <div className="space-y-3">
              {tontines.map(ton => {
                const cfg = TONTINE_STATUS_CONFIG[ton.status]
                const periodeNow = getCurrentPeriode(ton.frequency)
                const paidCount = ton.tontine_membres.filter(m => {
                  const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
                  return c && (c.status === 'paye' || c.status === 'partiel')
                }).length
                return (
                  <button
                    key={ton.id}
                    onClick={() => openDetail(ton.id)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-brand-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-2xl flex-shrink-0">🤝</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{ton.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatFcfa(ton.contribution_amount_fcfa)} FCFA · {FREQUENCY_LABELS[ton.frequency]} · {ton.tontine_membres.length} {t('tontine.members')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${cfg.classes}`}>{cfg.label}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>{formatPeriodeLabel(periodeNow, locale)}</span>
                      <span className="font-semibold text-brand-600">{paidCount}/{ton.tontine_membres.length} {t('tontine.cotPaid')} →</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ VUE DÉTAIL ═══════════════ */}
      {selected && (
        <>
          {/* Statut + lien public */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${TONTINE_STATUS_CONFIG[selected.status].classes}`}>
                {TONTINE_STATUS_CONFIG[selected.status].label}
              </span>
              <div className="flex items-center gap-1.5">
                {selected.status !== 'actif' && (
                  <button onClick={() => updateStatus(selected.id, 'actif')} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">▶ {t('tontine.activate')}</button>
                )}
                {selected.status === 'actif' && (
                  <button onClick={() => updateStatus(selected.id, 'pause')} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">⏸ {t('tontine.pause')}</button>
                )}
                {selected.status !== 'termine' && (
                  <button onClick={() => updateStatus(selected.id, 'termine')} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100">🏁 {t('tontine.finish')}</button>
                )}
              </div>
            </div>
            {selected.description && <p className="text-sm text-gray-500">{selected.description}</p>}
            <button
              onClick={() => openDiscussion(selected.id)}
              disabled={openingDiscussion}
              className="w-full py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {openingDiscussion ? '…' : '💬 Discussion du groupe'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => copyShareLink(selected.share_token)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                {copied ? `✅ ${t('tontine.copied')}` : `🔗 ${t('tontine.copyPublicLink')}`}
              </button>
              <button
                onClick={() => shareLink(selected)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                📤 {t('tontine.share')}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t('tontine.publicLinkHint')}</p>
          </div>

          {/* Sous-onglets */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['apercu', 'cotisations', 'membres'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${detailTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}
              >
                {tab === 'apercu' ? t('tontine.tabOverview') : tab === 'cotisations' ? t('tontine.tabContributions') : t('tontine.tabMembers')}
              </button>
            ))}
          </div>

          {/* ── Aperçu ── */}
          {detailTab === 'apercu' && (() => {
            const periodeNow = getCurrentPeriode(selected.frequency)
            // Les membres en attente/expirés n'ont pas encore validé leur invitation :
            // ils sont exclus des mécaniques de cotisation/cagnotte tant qu'ils ne sont pas "active".
            const membresSorted = [...selected.tontine_membres]
              .filter(m => effectiveMembreStatus(m) === 'active')
              .sort((a, b) => a.position - b.position)
            const pendingCount = selected.tontine_membres.length - membresSorted.length
            const totalCagnotte = selected.contribution_amount_fcfa * membresSorted.length
            const collecte = membresSorted.reduce((sum, m) => {
              const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
              return c && (c.status === 'paye' || c.status === 'partiel') ? sum + c.amount_fcfa + c.late_fee_fcfa : sum
            }, 0)
            const paidCount = membresSorted.filter(m => {
              const c = m.tontine_cotisations.find(co => co.periode === periodeNow)
              return c && (c.status === 'paye' || c.status === 'partiel')
            }).length
            const prochain = membresSorted.find(m => !m.has_received_pot) ?? null
            const pct = membresSorted.length ? Math.round((paidCount / membresSorted.length) * 100) : 0

            return (
              <div className="space-y-3">
                <div className="card">
                  <p className="text-xs text-gray-400 mb-1">{t('tontinePublic.potTitle')} — {formatPeriodeLabel(periodeNow, locale)}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatFcfa(collecte)} <span className="text-base font-normal text-gray-400">/ {formatFcfa(totalCagnotte)} FCFA</span></p>
                  <div className="w-full h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {t('tontinePublic.paidCount')
                      .replace('{paid}', String(paidCount))
                      .replace('{total}', String(membresSorted.length))
                      .replace('{pct}', String(pct))}
                  </p>
                </div>

                <div className="card">
                  <p className="text-xs text-gray-400 mb-2">{t('tontinePublic.nextPot')}</p>
                  {prochain ? (
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0">{prochain.position}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{prochain.full_name}</p>
                        <p className="text-xs text-gray-400">{t('tontinePublic.notYetReceived')}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{t('tontinePublic.allReceived')}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="card text-center">
                    <p className="text-xs text-gray-400 mb-1">Membres</p>
                    <p className="text-xl font-bold text-gray-900">{membresSorted.length}</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-xs text-gray-400 mb-1">{t('tontine.amount')} / {t('tontine.members')}</p>
                    <p className="text-xl font-bold text-gray-900">{formatFcfa(selected.contribution_amount_fcfa)}</p>
                  </div>
                </div>

                {pendingCount > 0 && (
                  <div className="card bg-amber-50 border-amber-200 flex items-center gap-2.5">
                    <span className="text-xl">⏳</span>
                    <p className="text-xs text-amber-700">
                      {pendingCount} {pendingCount > 1 ? 'membres' : 'membre'} en attente de validation — voir l&apos;onglet « {t('tontine.tabMembers')} ».
                    </p>
                  </div>
                )}

                {/* Overlay produit (tontine-produit) */}
                {selected.type === 'produit' && selected.tontine_product && (() => {
                  const tp = selected.tontine_product
                  const deliveries = tp.tontine_delivery_orders ?? []
                  const DELIVERY_LABELS: Record<DeliveryStatus, { label: string; icon: string; classes: string }> = {
                    en_attente: { label: t('tontine.deliveryEnAttente'), icon: '⏳', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
                    prepare:    { label: t('tontine.deliveryPrepare'),   icon: '📦', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
                    livre:      { label: t('tontine.deliveryLivre'),     icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
                    annule:     { label: t('tontine.deliveryAnnule'),    icon: '🚫', classes: 'bg-red-50 text-red-600 border-red-200' },
                  }
                  return (
                    <>
                      <div className={`card border-2 ${tp.validated_at ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{t('tontine.productConcerned')}</p>
                            <p className="font-bold text-gray-900">{tp.product_name}</p>
                            <p className="text-sm text-gray-500">{formatFcfa(tp.unit_price_fcfa)} FCFA</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${tp.validated_at ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {tp.validated_at ? t('tontine.stockValidated') : t('tontine.awaitingMerchant')}
                          </span>
                        </div>
                      </div>
                      {deliveries.length > 0 && (
                        <div className="card">
                          <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">{t('tontine.deliveryOrders')}</p>
                          <div className="space-y-2">
                            {[...deliveries].sort((a, b) => a.cycle_number - b.cycle_number).map(d => {
                              const cfg = DELIVERY_LABELS[d.status]
                              const winner = membresSorted.find(m => m.id === d.membre_id)
                              return (
                                <div key={d.id} className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                      {d.cycle_number}
                                    </span>
                                    <p className="text-sm text-gray-800 truncate">{winner?.full_name ?? '—'}</p>
                                  </div>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${cfg.classes}`}>
                                    {cfg.icon} {cfg.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {selected.notes && (
                  <div className="card bg-gray-50 border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-600">{selected.notes}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Cotisations ── */}
          {detailTab === 'cotisations' && (
            <div className="space-y-3">
              <div className="card flex items-center gap-3">
                <span className="text-lg">📅</span>
                <div className="flex-1">
                  <label className="label !mb-1">{t('tontine.periodTracked')}</label>
                  <input
                    type="text" value={periode}
                    onChange={e => setPeriode(e.target.value)}
                    placeholder="Ex : 2026-06 ou 2026-W23"
                    className="input"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('tontine.periodFormatHint')} {getCurrentPeriode(selected.frequency)}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {/* Les membres en attente/expirés n'ont pas encore validé — pas de cotisation à suivre pour eux. */}
                {[...selected.tontine_membres]
                  .filter(m => effectiveMembreStatus(m) === 'active')
                  .sort((a, b) => a.position - b.position)
                  .map(m => {
                  const c = findCotisation(m)
                  const cfg = COTISATION_STATUS_CONFIG[c?.status ?? 'en_attente']
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{m.position}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                          {c && c.late_fee_fcfa > 0 && (
                            <p className="text-xs text-red-500">+{formatFcfa(c.late_fee_fcfa)} FCFA de pénalité</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => cycleCotisation(m)}
                        disabled={savingCotisation === m.id}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border flex-shrink-0 transition-colors disabled:opacity-50 ${cfg.classes}`}
                      >
                        {savingCotisation === m.id ? '...' : `${cfg.icon} ${cfg.label}`}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-center">{t('tontine.cycleHint')}</p>
            </div>
          )}

          {/* ── Membres ── */}
          {detailTab === 'membres' && (
            <div className="space-y-3">
              {!showAddMembre ? (
                <button
                  onClick={() => setShowAddMembre(true)}
                  className="w-full bg-white border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 text-brand-700 font-semibold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="text-lg">+</span> {t('tontine.addMember')}
                </button>
              ) : (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">{t('tontine.newMember')}</h3>
                    <button onClick={() => setShowAddMembre(false)} className="text-gray-400 hover:text-gray-600 text-xl font-medium">×</button>
                  </div>
                  <input
                    type="text" value={newMembre.full_name}
                    onChange={e => setNewMembre(n => ({ ...n, full_name: e.target.value }))}
                    placeholder="Nom complet" className="input"
                  />
                  <PhoneInput
                    value={newMembre.phone}
                    onChange={v => setNewMembre(n => ({ ...n, phone: v }))}
                    placeholder="Téléphone (optionnel)"
                  />
                  <button onClick={handleAddMembre} disabled={savingMembre} className="btn-primary disabled:opacity-50">
                    {savingMembre ? t('tontine.adding') : t('tontine.addMemberAction')}
                  </button>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {[...selected.tontine_membres].sort((a, b) => a.position - b.position).map(m => {
                  const mStatus = effectiveMembreStatus(m)
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{m.position}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                            {m.is_admin && <span className="text-xs px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-brand-200 font-medium flex-shrink-0">Admin</span>}
                            {mStatus !== 'active' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium flex-shrink-0 ${MEMBRE_STATUS_CONFIG[mStatus].classes}`}>
                                {MEMBRE_STATUS_CONFIG[mStatus].label}
                              </span>
                            )}
                          </div>
                          {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {mStatus !== 'active' && (
                          <button
                            onClick={() => resendInvite(m)}
                            disabled={resendingId === m.id}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                          >
                            {resendingId === m.id ? t('tontine.resendingInvite') : `🔔 ${t('tontine.resendInvite')}`}
                          </button>
                        )}
                        {mStatus === 'active' && (
                          <button
                            onClick={() => toggleReceivedPot(m)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border transition-colors ${
                              m.has_received_pot
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {m.has_received_pot ? t('tontine.received') : t('tontine.notYet')}
                          </button>
                        )}
                        {!m.is_admin && (
                          <button onClick={() => removeMembre(m.id)} className="text-gray-300 hover:text-red-500 text-lg px-1">×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-center">{t('tontine.receivedHint')}</p>
              <p className="text-xs text-gray-400 text-center">{t('tontine.pendingMembersHint')}</p>
            </div>
          )}
        </>
      )}

    </div>
  )
}
