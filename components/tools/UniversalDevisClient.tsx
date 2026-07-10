'use client'

/**
 * UniversalDevisClient — Template universel GreenFlame
 *
 * Un seul composant pour tous les secteurs d'activité.
 * L'apparence et le comportement s'adaptent via SectorConfig.
 *
 * Usage :
 *   import { SECTOR_CONFIGS } from '@/lib/tools/sector-configs'
 *   import UniversalDevisClient from '@/components/tools/UniversalDevisClient'
 *
 *   <UniversalDevisClient
 *     config={SECTOR_CONFIGS.photographe}
 *     businessName="Studio Lumière"
 *     isPro={true}
 *   />
 */

import { useState, useEffect, useCallback } from 'react'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import type { SectorConfig } from '@/lib/tools/sector-configs'

// ─── Types ────────────────────────────────────────────────────────────────────

type Line = {
  description: string
  qty: number
  unit: string
  unitPrice: number
}

type DocStatus = 'brouillon' | 'envoye' | 'accepte' | 'paye' | 'en_retard' | 'annule'

type DocLine = {
  id: string
  description: string
  quantity: number
  unit_price_fcfa: number
  position: number
}

type Doc = {
  id: string
  type: 'devis' | 'facture'
  document_number: string
  status: DocStatus
  client_name: string
  client_phone: string | null
  issue_date: string
  valid_until: string | null
  notes: string | null
  total_fcfa: number
  linked_document_id: string | null
  created_at: string
  commercial_document_lines: DocLine[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FREE_LIMIT = 5

const STATUS_CONFIG: Record<DocStatus, { label: string; icon: string; classes: string }> = {
  brouillon: { label: 'Brouillon',   icon: '📝', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  envoye:    { label: 'Envoyé',      icon: '📤', classes: 'bg-blue-50 text-blue-600 border-blue-200' },
  accepte:   { label: 'Accepté',     icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
  paye:      { label: 'Payé',        icon: '💰', classes: 'bg-green-50 text-green-700 border-green-200' },
  en_retard: { label: 'En retard',   icon: '🔴', classes: 'bg-red-50 text-red-600 border-red-200' },
  annule:    { label: 'Annulé',      icon: '🚫', classes: 'bg-gray-50 text-gray-400 border-gray-200' },
}

const STATUS_NEXT: Record<DocStatus, DocStatus[]> = {
  brouillon: ['envoye', 'annule'],
  envoye:    ['accepte', 'annule'],
  accepte:   ['annule'],
  paye:      [],
  en_retard: [],
  annule:    ['brouillon'],
}

// ─── LocalStorage (compteur usage free tier) ──────────────────────────────────

function getMonthKey() {
  const d = new Date()
  return `gf_docs_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getUsedCount(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(getMonthKey()) ?? '0')
}
function incrementUsed() {
  const key = getMonthKey()
  const val = parseInt(localStorage.getItem(key) ?? '0') + 1
  localStorage.setItem(key, String(val))
  return val
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function UniversalDevisClient({
  config,
  businessName,
  isPro,
}: {
  config: SectorConfig
  businessName: string
  isPro: boolean
}) {
  // ── État client ──
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  // ── Champs sectoriels (clé → valeur) ──
  const [extraValues, setExtraValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.extraFields.map(f => [f.key, '']))
  )

  // ── Lignes de devis ──
  const [lines, setLines] = useState<Line[]>(() =>
    config.defaultLineItems.length > 0
      ? config.defaultLineItems.map(item => ({ ...item }))
      : [{ description: '', qty: 1, unit: config.units[0] ?? 'forfait', unitPrice: 0 }]
  )

  // ── Options & état ──
  const [notes, setNotes]           = useState('')
  const [validDays, setValidDays]   = useState(30)
  const [usedCount, setUsedCount]   = useState(0)
  const [history, setHistory]       = useState<Doc[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [savingDoc, setSavingDoc]   = useState(false)
  const [busyId, setBusyId]         = useState<string | null>(null)

  // ── Chargement ──
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/documents?type=${config.docType}`)
      if (res.ok) setHistory(await res.json())
    } catch {
      // silencieux
    } finally {
      setLoadingHistory(false)
    }
  }, [config.docType])

  useEffect(() => {
    setUsedCount(getUsedCount())
    loadHistory()
    // Pré-remplir depuis URL si montant passé
    const params = new URLSearchParams(window.location.search)
    const urlAmount = parseInt(params.get('amount') ?? '0')
    if (urlAmount > 0) {
      setLines([{ description: '', qty: 1, unit: config.units[0] ?? 'forfait', unitPrice: urlAmount }])
    }
  }, [loadHistory, config.units])

  // ── Calculs ──
  const total         = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const today         = new Date().toLocaleDateString('fr-FR')
  const expiry        = new Date(Date.now() + validDays * 86400000).toLocaleDateString('fr-FR')
  const remaining     = FREE_LIMIT - usedCount
  const isLimitReached = !isPro && remaining <= 0

  // ── Gestion des lignes ──
  function addLine() {
    setLines(prev => [...prev, { description: '', qty: 1, unit: config.units[0] ?? 'forfait', unitPrice: 0 }])
  }
  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateLine(i: number, field: keyof Line, value: string | number) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  // ── Gestion des champs sectoriels ──
  function setExtra(key: string, value: string) {
    setExtraValues(prev => ({ ...prev, [key]: value }))
  }

  // ── Génération PDF ──
  function buildHtml(docNum: string) {
    const filledExtras = config.extraFields.filter(f => extraValues[f.key])
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .logo { font-size: 22px; font-weight: bold; color: #166534; }
  .title { font-size: 26px; font-weight: bold; color: #166534; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 12px; }
  .section { margin: 20px 0; }
  .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
  .extras-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .extra-item.full { grid-column: span 2; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f0fdf4; padding: 10px 12px; text-align: left; font-size: 12px; color: #166534; border-bottom: 2px solid #bbf7d0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  .total-row { background: #166534; color: white; font-weight: bold; font-size: 16px; }
  .total-row td { padding: 14px 12px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
  .notes { background: #f9fafb; border-left: 4px solid #166534; padding: 12px; margin-top: 16px; font-size: 12px; }
</style></head>
<body>
<div class="header">
  <div>
    <div class="logo">🔥 GreenFlame</div>
    <div class="meta">${businessName} · Bénin</div>
  </div>
  <div style="text-align:right">
    <div class="title">${config.icon} ${config.documentTitle}</div>
    <div class="meta">${docNum}</div>
    <div class="meta">Émis le ${today}</div>
    <div class="meta">Valable jusqu'au ${expiry}</div>
  </div>
</div>

<div class="section">
  <div class="label">${config.clientLabel}</div>
  <div style="margin-top:6px;font-weight:600;font-size:15px">${clientName || '—'}</div>
  ${clientPhone ? `<div class="meta">${clientPhone}</div>` : ''}
</div>

${filledExtras.length > 0 ? `
<div class="extras-grid">
  ${filledExtras.map(f => `
    <div class="extra-item${f.span === 'full' ? ' full' : ''}">
      <div class="label">${f.label}</div>
      <div style="font-weight:500">${extraValues[f.key]}</div>
    </div>
  `).join('')}
</div>` : ''}

<table>
  <thead><tr>
    <th style="width:45%">Description</th>
    <th style="text-align:center;width:10%">Qté</th>
    <th style="text-align:center;width:10%">Unité</th>
    <th style="text-align:right;width:15%">Prix unit.</th>
    <th style="text-align:right;width:20%">Total</th>
  </tr></thead>
  <tbody>
    ${lines.map(l => `<tr>
      <td>${l.description || '—'}</td>
      <td style="text-align:center">${l.qty}</td>
      <td style="text-align:center;color:#6b7280">${l.unit}</td>
      <td style="text-align:right">${formatFcfa(l.unitPrice)} FCFA</td>
      <td style="text-align:right">${formatFcfa(l.qty * l.unitPrice)} FCFA</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="4">TOTAL TTC</td>
      <td style="text-align:right">${formatFcfa(total)} FCFA</td>
    </tr>
  </tbody>
</table>

${notes ? `<div class="notes"><strong>Notes :</strong> ${notes}</div>` : ''}
<div class="footer">${config.footerNote}</div>
</body></html>`
  }

  // ── Sauvegarde + impression ──
  async function generateAndSave() {
    if (isLimitReached || total === 0 || savingDoc) return
    setSavingDoc(true)
    const docNum = `${config.documentPrefix}-${Date.now().toString(36).toUpperCase()}`

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.docType,
          document_number: docNum,
          status: 'envoye',
          client_name: clientName || 'Client',
          client_phone: clientPhone || null,
          issue_date: new Date().toISOString().slice(0, 10),
          valid_until: new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10),
          notes: [
            notes,
            // Stocker les champs sectoriels dans les notes (JSON compact)
            Object.keys(extraValues).filter(k => extraValues[k]).length > 0
              ? `[SECTEUR] ${JSON.stringify(extraValues)}`
              : '',
          ].filter(Boolean).join('\n') || null,
          lines: lines.map(l => ({
            description: `${l.description}${l.unit ? ` (${l.unit})` : ''}`,
            quantity: l.qty,
            unit_price_fcfa: l.unitPrice,
          })),
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        setHistory(prev => [saved, ...prev])
        toast.success(`${config.documentTitle} ${docNum} sauvegardé`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erreur de sauvegarde')
      }
    } catch {
      toast.error('Hors connexion — le document sera imprimé sans sauvegarde')
    } finally {
      setSavingDoc(false)
    }

    // Impression
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(buildHtml(docNum))
      w.document.close()
      w.print()
    }

    if (!isPro) {
      const newCount = incrementUsed()
      setUsedCount(newCount)
    }
  }

  // ── Changement de statut ──
  async function changeStatus(doc: Doc, status: DocStatus) {
    setBusyId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setHistory(prev => prev.map(d => d.id === doc.id ? updated : d))
        toast.success(`${doc.document_number} → ${STATUS_CONFIG[status].label}`)
      } else {
        toast.error('Mise à jour impossible')
      }
    } finally {
      setBusyId(null)
    }
  }

  // ── Conversion devis → facture ──
  async function convertToFacture(doc: Doc) {
    setBusyId(doc.id)
    try {
      const factureNum = `FAC-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'facture',
          document_number: factureNum,
          status: 'envoye',
          client_name: doc.client_name,
          client_phone: doc.client_phone,
          issue_date: new Date().toISOString().slice(0, 10),
          notes: doc.notes,
          linked_document_id: doc.id,
          lines: doc.commercial_document_lines.map(l => ({
            description: l.description,
            quantity: l.quantity,
            unit_price_fcfa: l.unit_price_fcfa,
          })),
        }),
      })
      if (res.ok) {
        await fetch(`/api/documents/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepte' }),
        })
        toast.success(`Facture ${factureNum} créée`)
        loadHistory()
      } else {
        toast.error('Conversion impossible')
      }
    } finally {
      setBusyId(null)
    }
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {config.icon} {config.toolName}
        </h1>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">← Outils</Link>
      </div>

      {/* Bandeau tier */}
      {isPro ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">PRO</span>
          <span className="text-amber-700 text-xs">Documents illimités</span>
        </div>
      ) : isLimitReached ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-red-700 text-sm font-semibold">Limite mensuelle atteinte</p>
            <p className="text-red-500 text-xs mt-0.5">{usedCount}/{FREE_LIMIT} documents utilisés ce mois</p>
          </div>
          <Link href="/merchant/upgrade" className="flex-shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            Passer Pro
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
          <span className="text-brand-700 text-xs">
            {remaining} document{remaining > 1 ? 's' : ''} gratuit{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} ce mois
          </span>
          <Link href="/merchant/upgrade" className="text-brand-600 text-xs font-semibold underline underline-offset-2">
            Passer Pro
          </Link>
        </div>
      )}

      {isLimitReached ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-4xl">📄</p>
          <p className="font-semibold text-gray-700">Documents illimités avec GreenFlame Pro</p>
          <p className="text-sm text-gray-400">Débloquez tous vos outils professionnels sans limite</p>
          <Link href="/merchant/upgrade" className="inline-block bg-brand-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">
            Voir les offres
          </Link>
        </div>
      ) : (
        <>
          {/* Section client */}
          <div className="card space-y-4">
            <p className="font-semibold text-gray-700 text-sm">Informations client</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{config.clientLabel}</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder={config.clientPlaceholder}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <PhoneInput value={clientPhone} onChange={setClientPhone} placeholder="97 00 00 00" />
              </div>
            </div>
          </div>

          {/* Champs sectoriels spécifiques */}
          {config.extraFields.length > 0 && (
            <div className="card space-y-3">
              <p className="font-semibold text-gray-700 text-sm">Détails de la prestation</p>
              <div className="grid grid-cols-2 gap-3">
                {config.extraFields.map(field => (
                  <div
                    key={field.key}
                    className={field.span === 'full' ? 'col-span-2' : ''}
                  >
                    <label className="label">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        value={extraValues[field.key] ?? ''}
                        onChange={e => setExtra(field.key, e.target.value)}
                        className="input"
                      >
                        <option value="">— Sélectionner —</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={extraValues[field.key] ?? ''}
                        onChange={e => setExtra(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={2}
                        className="input resize-none"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={extraValues[field.key] ?? ''}
                        onChange={e => setExtra(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="input"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lignes de prestation */}
          <div className="card space-y-3">
            <p className="font-semibold text-gray-700 text-sm">Prestations & tarifs</p>
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-start">
                {/* Description */}
                <div className="flex-1">
                  <input
                    value={line.description}
                    onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder="Description de la prestation"
                    className="input text-sm"
                  />
                </div>
                {/* Quantité */}
                <div className="w-14">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.qty || ''}
                    onChange={e => updateLine(i, 'qty', parseFloat(e.target.value) || 1)}
                    className="input text-sm text-center"
                    placeholder="1"
                  />
                </div>
                {/* Unité */}
                {config.units.length > 1 ? (
                  <div className="w-24">
                    <select
                      value={line.unit}
                      onChange={e => updateLine(i, 'unit', e.target.value)}
                      className="input text-sm"
                    >
                      {config.units.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="w-20 flex items-center justify-center">
                    <span className="text-xs text-gray-400">{config.units[0]}</span>
                  </div>
                )}
                {/* Prix unitaire */}
                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    value={line.unitPrice || ''}
                    onChange={e => updateLine(i, 'unitPrice', parseInt(e.target.value) || 0)}
                    placeholder="FCFA"
                    className="input text-sm text-right"
                  />
                </div>
                {/* Supprimer */}
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(i)}
                    className="text-red-400 hover:text-red-600 text-lg mt-2 flex-shrink-0"
                  >×</button>
                )}
              </div>
            ))}
            <button
              onClick={addLine}
              className="text-brand-600 text-sm font-medium hover:text-brand-700"
            >
              + Ajouter une ligne
            </button>
          </div>

          {/* Notes + validité + total */}
          <div className="card space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Notes / Conditions</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="Conditions de paiement, délais, remarques..."
                />
              </div>
              <div className="w-28">
                <label className="label">Validité (jours)</label>
                <input
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={e => setValidDays(parseInt(e.target.value) || 30)}
                  className="input text-center"
                />
              </div>
            </div>
            <div className="flex justify-between items-center bg-brand-50 rounded-xl px-4 py-3">
              <span className="font-semibold text-gray-700">TOTAL TTC</span>
              <span className="text-xl font-bold text-brand-700">{formatFcfa(total)} FCFA</span>
            </div>
          </div>

          {/* Bouton principal */}
          <button
            onClick={generateAndSave}
            disabled={total === 0 || savingDoc}
            className="btn-primary"
          >
            {savingDoc ? 'Génération en cours…' : config.generateBtnLabel}
          </button>
          <p className="text-center text-xs text-gray-400 -mt-2">
            Le document est sauvegardé et s'ouvre pour impression
          </p>
        </>
      )}

      {/* Historique */}
      <div className="pt-2">
        <h2 className="font-semibold text-gray-900 mb-3">Historique</h2>

        {loadingHistory && (
          <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
        )}

        {!loadingHistory && history.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">{config.icon}</p>
            <p className="text-gray-500 text-sm">Aucun document pour ce secteur</p>
          </div>
        )}

        <div className="space-y-3">
          {history.map((doc) => {
            const cfg     = STATUS_CONFIG[doc.status]
            const nexts   = STATUS_NEXT[doc.status] ?? []
            const busy    = busyId === doc.id
            return (
              <div key={doc.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{doc.document_number}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {doc.client_name}{doc.client_phone ? ` · ${doc.client_phone}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Émis le {new Date(doc.issue_date).toLocaleDateString('fr-FR')}
                      {doc.valid_until
                        ? ` · Valable jusqu'au ${new Date(doc.valid_until).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                  <p className="font-bold text-brand-600 text-sm flex-shrink-0">
                    {formatFcfa(doc.total_fcfa)}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap pt-1">
                  {nexts.map((next) => (
                    <button
                      key={next}
                      disabled={busy}
                      onClick={() => changeStatus(doc, next)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl border ${STATUS_CONFIG[next].classes} disabled:opacity-50`}
                    >
                      {STATUS_CONFIG[next].icon} Marquer {STATUS_CONFIG[next].label}
                    </button>
                  ))}
                  {doc.status === 'accepte' && config.docType === 'devis' && (
                    <button
                      disabled={busy}
                      onClick={() => convertToFacture(doc)}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-600 text-white disabled:opacity-50"
                    >
                      → Convertir en facture
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
