'use client'

/**
 * /admin/ucp — Registre permanent des Bulletins de Souscription UCP
 *
 * Fonctions :
 *  - Émettre un nouveau bulletin (formulaire + prévisualisation avant envoi)
 *  - Voir tous les bulletins (tous statuts)
 *  - Filtrer par statut et type
 *  - Confirmer le paiement sur les bulletins "user_signed"
 *  - Télécharger le PDF des bulletins "signed"
 */

import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type BsdStatus = 'pending' | 'user_signed' | 'signed' | 'revoked'

interface RegistryEntry {
  id:                 string
  bsd_number:         string
  status:             BsdStatus
  subscription_type:  'purchase' | 'attribution'
  ucp_parts:          number
  prix_unitaire_fcfa: number
  amount_fcfa:        number
  notes:              string | null
  payment_note:       string | null
  pdf_url:            string | null
  created_at:         string
  accepted_at:        string | null
  otp_verified_at:    string | null
  pin_verified_at:    string | null
  confirmed_at:       string | null
  revoked_at:         string | null
  revocation_reason:  string | null
  // jointures
  beneficiary_name:   string
  beneficiary_phone:  string | null
  beneficiary_email:  string | null
  issuer_name:        string
  confirmer_name:     string | null
}

interface UserOption { id: string; full_name: string; phone: string | null; email?: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<BsdStatus, { label: string; color: string; icon: string }> = {
  pending:     { label: 'En attente',        color: 'bg-amber-100 text-amber-700', icon: '⏳' },
  user_signed: { label: 'Signé — à valider', color: 'bg-blue-100 text-blue-700',   icon: '✍️' },
  signed:      { label: 'Confirmé',          color: 'bg-green-100 text-green-700', icon: '✅' },
  revoked:     { label: 'Révoqué',           color: 'bg-red-100 text-red-700',     icon: '❌' },
}

function fmt(n: number) { return n.toLocaleString('fr-FR') }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ALL_STATUSES: BsdStatus[] = ['pending', 'user_signed', 'signed', 'revoked']

// ── Prévisualisation BSD ──────────────────────────────────────────────────────

interface BsdPreviewProps {
  userName:         string
  userPhone:        string
  userEmail:        string
  subscriptionType: 'purchase' | 'attribution'
  ucpParts:         number
  unitPrice:        number
  totalAmount:      number
  notes:            string
  onConfirm:        () => void
  onClose:          () => void
  busy:             boolean
}

function BsdPreview({
  userName, userPhone, userEmail,
  subscriptionType, ucpParts, unitPrice, totalAmount, notes,
  onConfirm, onClose, busy,
}: BsdPreviewProps) {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-2xl overflow-hidden">

        {/* Barre d'action */}
        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-sm">Prévisualisation — BSD-UCP</p>
            <p className="text-gray-400 text-xs">Vérifiez les informations avant d&apos;émettre le bulletin</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors"
            >
              ✕ Modifier
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {busy ? 'Émission…' : '📤 Émettre ce bulletin'}
            </button>
          </div>
        </div>

        {/* Document BSD */}
        <div className="font-sans text-xs text-gray-900">

          {/* En-tête vert */}
          <div className="bg-[#1a6b3c] px-6 py-4 flex justify-between items-start">
            <div>
              <p className="text-white font-bold text-xl">GreenFlame</p>
              <p className="text-green-200 text-xs">greenflame.africa</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">BULLETIN DE SOUSCRIPTION DE DROITS UCP</p>
              <p className="text-green-200 text-xs mt-0.5">Ubuntu Capital Plan — GreenFlame Africa</p>
              <p className="text-white font-bold mt-1">BSD-{new Date().getFullYear()}-XXXX</p>
            </div>
          </div>

          <div className="px-8 py-5 space-y-4">

            {/* Titre */}
            <div className="text-center pb-2 border-b border-green-200">
              <p className="text-[#1a6b3c] font-bold text-base">Ubuntu Capital Plan — GreenFlame</p>
              <p className="text-gray-500 text-[11px] mt-0.5">Aperçu — numéro et date seront attribués à l&apos;émission</p>
            </div>

            {/* ENTRE LES PARTIES */}
            <div>
              <p className="text-[#1a6b3c] font-bold text-[10px] tracking-wider uppercase mb-2">
                Émetteur / Souscripteur
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f0fdf4] rounded-lg p-3 border border-[#d1fae5]">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">Émetteur</p>
                  <p className="font-bold text-sm">GreenFlame Africa SARL</p>
                  <p className="text-gray-600 text-[11px]">Société enregistrée au Bénin</p>
                  <p className="text-gray-600 text-[11px]">Représentée par : Administration GreenFlame</p>
                </div>
                <div className="bg-[#f0fdf4] rounded-lg p-3 border border-[#d1fae5]">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">Souscripteur</p>
                  <p className="font-bold text-sm">{userName || '—'}</p>
                  {userPhone && <p className="text-gray-600 text-[11px]">Tél. : {userPhone}</p>}
                  {userEmail && <p className="text-gray-600 text-[11px]">Email : {userEmail}</p>}
                </div>
              </div>
            </div>

            {/* OBJET */}
            <div>
              <p className="text-[#1a6b3c] font-bold text-[10px] tracking-wider uppercase mb-2">
                Objet de la souscription
              </p>
              <div className="bg-[#f0fdf4] rounded-lg border border-[#d1fae5] overflow-hidden">
                {[
                  ['Type de souscription', subscriptionType === 'purchase' ? '☑ Souscription par achat    ☐ Attribution' : '☐ Souscription par achat    ☑ Attribution'],
                  ['Nombre de parts UCP', `${fmt(ucpParts)} part${ucpParts > 1 ? 's' : ''}`],
                  ...(subscriptionType === 'purchase' ? [
                    ['Prix unitaire par part', `${fmt(unitPrice)} FCFA`],
                    ['Montant total', `${fmt(totalAmount)} FCFA`],
                  ] : [
                    ['Contrepartie', 'Attribution — aucune contrepartie financière directe'],
                  ]),
                ].map(([k, v], i, arr) => (
                  <div key={k} className={`flex gap-4 px-3 py-2 ${i < arr.length - 1 ? 'border-b border-[#d1fae5]' : ''}`}>
                    <span className="text-gray-500 w-44 shrink-0">{k} :</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
                {notes && (
                  <div className="flex gap-4 px-3 py-2 border-t border-[#d1fae5]">
                    <span className="text-gray-500 w-44 shrink-0">Note interne :</span>
                    <span className="italic text-gray-600">{notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* DROITS CONFÉRÉS */}
            <div>
              <p className="text-[#1a6b3c] font-bold text-[10px] tracking-wider uppercase mb-2">
                Droits conférés
              </p>
              <p className="text-gray-700 leading-relaxed text-[11px] text-justify">
                Les parts UCP souscrites confèrent au titulaire un <strong>droit préférentiel
                et prioritaire à l&apos;acquisition d&apos;actions GreenFlame SA</strong>, à hauteur
                équivalente, lors de l&apos;émission desdites actions ou de toute opération
                d&apos;ouverture du capital de GreenFlame.
              </p>
              <p className="text-gray-700 leading-relaxed text-[11px] text-justify mt-2">
                Ce bulletin ne constitue pas une action et ne confère pas, à ce stade, de droit
                de vote ni de droit aux dividendes. Il matérialise un <strong>engagement
                contractuel de GreenFlame</strong> à émettre les actions correspondantes en
                priorité au profit du souscripteur, dans les conditions alors en vigueur lors
                de ladite émission.
              </p>
            </div>

            {/* EMPREINTE */}
            <div>
              <p className="text-[#1a6b3c] font-bold text-[10px] tracking-wider uppercase mb-2">
                Empreinte de validation
              </p>
              <div className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
                {[
                  'Étape 1 — Acceptation des termes',
                  'Étape 2 — Vérification OTP WhatsApp',
                  'Étape 3 — PIN transaction',
                  'Confirmation admin (paiement reçu)',
                ].map((k, i, arr) => (
                  <div key={k} className={`flex gap-4 px-3 py-2 ${i < arr.length - 1 ? 'border-b border-amber-200' : ''}`}>
                    <span className="text-gray-500 w-52 shrink-0">{k} :</span>
                    <span className="italic text-gray-400 text-[10px]">sera horodaté à la signature</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SIGNATURES */}
            <div className="border-t border-[#d1fae5] pt-3">
              <p className="text-[#1a6b3c] font-bold text-[10px] tracking-wider uppercase mb-2">Signatures</p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-gray-500 text-[10px]">Le Souscripteur</p>
                  <p className="font-bold text-sm">{userName || '—'}</p>
                  <p className="text-gray-400 text-[10px] mt-1 italic">Signature électronique à la validation</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px]">Pour GreenFlame Africa</p>
                  <p className="font-bold text-sm">Administration GreenFlame</p>
                  <p className="text-gray-400 text-[10px] mt-1 italic">À la confirmation admin</p>
                </div>
              </div>
            </div>

            {/* Pied */}
            <div className="border-t border-[#d1fae5] pt-2 text-center">
              <p className="text-gray-400 text-[10px]">
                BSD-{new Date().getFullYear()}-XXXX · GreenFlame Africa · greenflame.africa ·
                Document confidentiel — usage exclusif des parties signataires
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function AdminUcpPage() {
  const [entries,      setEntries]      = useState<RegistryEntry[]>([])
  const [users,        setUsers]        = useState<UserOption[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterStatus, setFilterStatus] = useState<BsdStatus | 'all'>('all')
  const [filterType,   setFilterType]   = useState<'all' | 'purchase' | 'attribution'>('all')
  const [selected,     setSelected]     = useState<RegistryEntry | null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [showPreview,  setShowPreview]  = useState(false)
  const [busy,         setBusy]         = useState(false)
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null)

  // Formulaire émission
  const [form, setForm] = useState({
    user_id: '', subscription_type: 'purchase', ucp_parts: '', prix_unitaire_fcfa: '', notes: '',
  })
  const totalComputed = (Number(form.ucp_parts) || 0) * (Number(form.prix_unitaire_fcfa) || 0)
  const selectedUser  = users.find(u => u.id === form.user_id)

  // Formulaire confirmation
  const [paymentNote, setPaymentNote] = useState('')

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [regRes, usersRes] = await Promise.all([
      fetch('/api/ucp'),
      fetch('/api/admin/users-list').catch(() => ({ ok: false, json: async () => ({}) })),
    ])
    const regData = await regRes.json()
    setEntries(regData.subscriptions ?? [])

    if ((usersRes as Response).ok) {
      const ud = await (usersRes as Response).json()
      setUsers(ud.users ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filtres ─────────────────────────────────────────────────────────────────
  const visible = entries.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterType   !== 'all' && e.subscription_type !== filterType) return false
    return true
  })

  // ── Totaux registre ──────────────────────────────────────────────────────────
  const totals = {
    total:   entries.length,
    signed:  entries.filter(e => e.status === 'signed').length,
    parts:   entries.filter(e => e.status === 'signed').reduce((s,e) => s + e.ucp_parts, 0),
    capital: entries.filter(e => e.status === 'signed' && e.subscription_type === 'purchase')
                    .reduce((s,e) => s + e.amount_fcfa, 0),
    pending: entries.filter(e => e.status === 'user_signed').length,
  }

  // ── Émettre un bulletin ──────────────────────────────────────────────────────
  async function submitEmission() {
    if (!form.user_id || !form.ucp_parts) return
    setBusy(true); setMsg(null)
    try {
      const res  = await fetch('/api/ucp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id:            form.user_id,
          subscription_type:  form.subscription_type,
          ucp_parts:          Number(form.ucp_parts),
          prix_unitaire_fcfa: form.subscription_type === 'attribution' ? 0 : Number(form.prix_unitaire_fcfa || 0),
          notes:              form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.error ?? 'Erreur', ok: false }); setShowPreview(false); return }
      setMsg({ text: `Bulletin ${data.subscription?.bsd_number} émis — notif WhatsApp envoyée`, ok: true })
      setForm({ user_id: '', subscription_type: 'purchase', ucp_parts: '', prix_unitaire_fcfa: '', notes: '' })
      setShowForm(false); setShowPreview(false)
      load()
    } finally { setBusy(false) }
  }

  // ── Confirmer paiement ───────────────────────────────────────────────────────
  async function confirmPayment(id: string) {
    setBusy(true); setMsg(null)
    try {
      const res  = await fetch(`/api/ucp/${id}/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_note: paymentNote || null }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.error ?? 'Erreur', ok: false }); return }
      setMsg({ text: 'Bulletin confirmé — PDF généré', ok: true })
      setSelected(null); setPaymentNote('')
      load()
    } finally { setBusy(false) }
  }

  const canPreview = !!form.user_id && !!form.ucp_parts &&
    (form.subscription_type === 'attribution' || !!form.prix_unitaire_fcfa)

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📜 Registre UCP</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Bulletins de Souscription de Droits — Ubuntu Capital Plan
          </p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setMsg(null); setShowPreview(false) }}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          {showForm ? '✕ Fermer' : '+ Émettre un bulletin'}
        </button>
      </div>

      {/* Message global */}
      {msg && !showPreview && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          msg.ok ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {msg.text}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total bulletins',  value: totals.total,                       color: 'text-white'      },
          { label: 'Confirmés',        value: totals.signed,                      color: 'text-green-400'  },
          { label: 'À valider',        value: totals.pending,                     color: 'text-blue-400'   },
          { label: 'Parts UCP émises', value: fmt(totals.parts),                  color: 'text-brand-400'  },
          { label: 'Capital levé',     value: fmt(totals.capital) + ' FCFA',      color: 'text-amber-400'  },
        ].map(k => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4">
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-400 text-xs mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Formulaire émission ── */}
      {showForm && (
        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-white">Nouveau bulletin BSD-UCP</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bénéficiaire */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Bénéficiaire *</label>
              {users.length > 0 ? (
                <select
                  value={form.user_id}
                  onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
                >
                  <option value="">— Sélectionner un membre —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}{u.phone ? ` — ${u.phone}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="UUID du membre"
                  value={form.user_id}
                  onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
                />
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type de souscription *</label>
              <div className="flex gap-4 pt-1">
                {(['purchase', 'attribution'] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sub_type" value={t}
                      checked={form.subscription_type === t}
                      onChange={() => setForm(f => ({ ...f, subscription_type: t }))}
                      className="accent-brand-500"
                    />
                    <span className="text-sm text-gray-200">
                      {t === 'purchase' ? '💳 Achat' : '🎁 Attribution'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Parts */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre de parts UCP *</label>
              <input
                type="number" min={1}
                placeholder="Ex : 50"
                value={form.ucp_parts}
                onChange={e => setForm(f => ({ ...f, ucp_parts: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
              />
            </div>

            {/* Prix + total calculé */}
            {form.subscription_type === 'purchase' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Prix par part au moment T (FCFA) *</label>
                  <input
                    type="number" min={1}
                    placeholder="Ex : 10000"
                    value={form.prix_unitaire_fcfa}
                    onChange={e => setForm(f => ({ ...f, prix_unitaire_fcfa: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
                  />
                </div>
                {totalComputed > 0 && (
                  <div className="md:col-span-2 bg-gray-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-gray-400 text-sm">
                      {fmt(Number(form.ucp_parts))} parts
                      × {fmt(Number(form.prix_unitaire_fcfa))} FCFA =
                    </span>
                    <span className="text-brand-300 font-bold text-base">
                      {fmt(totalComputed)} FCFA
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">(figé à l&apos;émission)</span>
                  </div>
                )}
              </>
            )}

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Note interne (optionnel)</label>
              <input
                type="text"
                placeholder="Ex : Attribution suite à performance Q2 2026"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
              />
            </div>
          </div>

          <button
            onClick={() => setShowPreview(true)}
            disabled={!canPreview}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors disabled:opacity-40"
          >
            👁 Prévisualiser le bulletin
          </button>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BsdStatus | 'all')}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 text-sm focus:outline-none"
        >
          <option value="all">Tous les statuts</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s].icon} {STATUS_META[s].label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as 'all' | 'purchase' | 'attribution')}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-200 text-sm focus:outline-none"
        >
          <option value="all">Tous les types</option>
          <option value="purchase">💳 Achat</option>
          <option value="attribution">🎁 Attribution</option>
        </select>
        <span className="text-gray-500 text-sm self-center">
          {visible.length} bulletin{visible.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Registre ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-gray-800 rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-400">Aucun bulletin pour ces critères</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['Référence BSD', 'Membre', 'Type', 'Parts UCP', 'Montant', 'Statut', 'Émis le', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-400 font-semibold px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(e => {
                const s = STATUS_META[e.status]
                return (
                  <tr key={e.id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand-400 font-semibold whitespace-nowrap">
                      {e.bsd_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{e.beneficiary_name}</p>
                      {e.beneficiary_phone && <p className="text-gray-400 text-xs">{e.beneficiary_phone}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.subscription_type === 'purchase' ? '💳 Achat' : '🎁 Attribution'}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{fmt(e.ucp_parts)}</td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {e.subscription_type === 'attribution' ? '—' : fmt(e.amount_fcfa) + ' FCFA'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {fmtDate(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(e); setPaymentNote('') }}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                        >
                          Détail
                        </button>
                        {e.status === 'user_signed' && (
                          <button
                            onClick={() => { setSelected(e); setPaymentNote('') }}
                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 transition-colors font-semibold"
                          >
                            ✓ Valider
                          </button>
                        )}
                        {e.status === 'signed' && e.pdf_url && (
                          <a
                            href={`/api/ucp/${e.id}/pdf`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-lg bg-green-900/30 hover:bg-green-900/50 transition-colors"
                          >
                            📄 PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal détail / confirmation ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">{selected.bsd_number}</h2>
              <button onClick={() => { setSelected(null); setMsg(null) }}
                className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ['Bénéficiaire',  selected.beneficiary_name],
                ['Téléphone',     selected.beneficiary_phone ?? '—'],
                ['Email',         selected.beneficiary_email ?? '—'],
                ['Type',          selected.subscription_type === 'purchase' ? '💳 Achat' : '🎁 Attribution'],
                ['Parts UCP',     fmt(selected.ucp_parts)],
                ...(selected.subscription_type === 'purchase' ? [
                  ['Prix / part',   fmt(selected.prix_unitaire_fcfa) + ' FCFA'],
                  ['Montant',       fmt(selected.amount_fcfa) + ' FCFA'],
                ] : []),
                ['Émis par',      selected.issuer_name],
                ['Émis le',       fmtDate(selected.created_at)],
                ['Accepté',       fmtDate(selected.accepted_at)],
                ['OTP vérifié',   fmtDate(selected.otp_verified_at)],
                ['PIN vérifié',   fmtDate(selected.pin_verified_at)],
                ['Confirmé le',   fmtDate(selected.confirmed_at)],
                ['Confirmé par',  selected.confirmer_name ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white text-right">{v}</span>
                </div>
              ))}
              {selected.notes && (
                <div className="bg-gray-700 rounded-xl p-3 text-xs text-gray-300">
                  📝 {selected.notes}
                </div>
              )}
            </div>

            {selected.status === 'user_signed' && (
              <div className="border-t border-gray-700 pt-4 space-y-3">
                <p className="text-sm font-semibold text-white">Confirmer la réception du paiement</p>
                <input
                  type="text"
                  placeholder="Note de paiement (réf. MTN, virement…)"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-400"
                />
                {selected.subscription_type === 'attribution' && (
                  <p className="text-xs text-gray-400">Attribution — aucun paiement requis.</p>
                )}
                <button
                  onClick={() => confirmPayment(selected.id)}
                  disabled={busy}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Confirmation…' : '✅ Confirmer et générer le PDF'}
                </button>
                {msg && (
                  <p className={`text-xs text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {msg.text}
                  </p>
                )}
              </div>
            )}

            {selected.status === 'signed' && selected.pdf_url && (
              <a
                href={`/api/ucp/${selected.id}/pdf`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                📄 Télécharger le BSD-UCP
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Prévisualisation avant émission ── */}
      {showPreview && (
        <BsdPreview
          userName         = {selectedUser?.full_name ?? form.user_id}
          userPhone        = {selectedUser?.phone ?? ''}
          userEmail        = {selectedUser?.email ?? ''}
          subscriptionType = {form.subscription_type as 'purchase' | 'attribution'}
          ucpParts         = {Number(form.ucp_parts) || 0}
          unitPrice        = {Number(form.prix_unitaire_fcfa) || 0}
          totalAmount      = {totalComputed}
          notes            = {form.notes}
          onConfirm        = {submitEmission}
          onClose          = {() => setShowPreview(false)}
          busy             = {busy}
        />
      )}
    </div>
  )
}
