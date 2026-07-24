'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import PhoneInput from '@/components/ui/PhoneInput'

// ── Types publics (importés dans page.tsx) ──────────────────────────

export interface MerchantProfile {
  businessName: string
  address:      string | null
  city:         string | null
  phone:        string | null
  ifu:          string | null
  rccm:         string | null
}

export interface CatalogProduct {
  id:        string
  name:      string
  priceFcfa: number
  emoji:     string | null
}

// ── Types internes ──────────────────────────────────────────────────

type DocType   = 'facture' | 'devis'
type DocStatus = 'brouillon' | 'envoye' | 'accepte' | 'paye' | 'en_retard' | 'annule'

interface Line {
  description: string
  qty:         number
  unitPrice:   number
  unit:        string
}

interface DocLine {
  id:             string
  description:    string
  quantity:       number
  unit_price_fcfa: number
  unit:           string
  position:       number
}

interface Doc {
  id:               string
  type:             DocType
  document_number:  string
  status:           DocStatus
  client_name:      string
  client_phone:     string | null
  client_ifu:       string | null
  client_address:   string | null
  issue_date:       string
  due_date:         string | null
  notes:            string | null
  total_fcfa:       number
  has_tva:          boolean
  aib_rate:         number
  platform_ref:     string | null
  linked_document_id: string | null
  created_at:       string
  commercial_document_lines: DocLine[]
}

// ── Constantes ──────────────────────────────────────────────────────

const FREE_LIMIT = 5

const UNITS = ['u', 'kg', 'g', 'm', 'm²', 'L', 'h', 'j', 'forfait', 'lot']

const STATUS_CFG: Record<DocStatus, { label: string; icon: string; color: string }> = {
  brouillon: { label: 'Brouillon',   icon: '📝', color: 'text-gray-500 bg-gray-100 border-gray-200' },
  envoye:    { label: 'Envoyé',      icon: '📤', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  accepte:   { label: 'Accepté',     icon: '✅', color: 'text-green-700 bg-green-50 border-green-200' },
  paye:      { label: 'Payé',        icon: '💰', color: 'text-green-700 bg-green-50 border-green-200' },
  en_retard: { label: 'En retard',   icon: '🔴', color: 'text-red-600 bg-red-50 border-red-200' },
  annule:    { label: 'Annulé',      icon: '🚫', color: 'text-gray-400 bg-gray-50 border-gray-200' },
}

const NEXT_STATUS: Record<DocStatus, DocStatus[]> = {
  brouillon: ['envoye', 'annule'],
  envoye:    ['paye', 'en_retard', 'annule'],
  en_retard: ['paye', 'annule'],
  accepte:   ['paye', 'en_retard'],
  paye:      [],
  annule:    ['brouillon'],
}

// ── Helpers ─────────────────────────────────────────────────────────

function getMonthKey() {
  const d = new Date()
  return `gf_docs_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getUsedCount() {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(getMonthKey()) ?? '0')
}
function incrementUsed() {
  const key = getMonthKey()
  const val  = parseInt(localStorage.getItem(key) ?? '0') + 1
  localStorage.setItem(key, String(val))
  return val
}
function nextDocNumber(type: DocType) {
  const prefix = type === 'facture' ? 'FAC' : 'DEV'
  const key    = `gf_${prefix}_seq`
  const seq    = parseInt(localStorage.getItem(key) ?? '0') + 1
  localStorage.setItem(key, String(seq))
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
}
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Générateur HTML (PDF) ────────────────────────────────────────────

interface PdfOpts {
  docType:      DocType
  num:          string
  today:        string
  dueDate:      string
  merchant:     MerchantProfile
  clientName:   string
  clientPhone:  string
  clientIfu:    string
  clientAddress: string
  lines:        Line[]
  hasTva:       boolean
  hasAib:       boolean
  aibRate:      number
  paymentMode:  string
  paymentCoords: string
  paymentDelay: string
  notes:        string
  platformRef:  string
  paid:         boolean
}

function buildHtml(o: PdfOpts): string {
  const totalHt   = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const tva       = o.hasTva ? Math.round(totalHt * 0.18) : 0
  const aib       = o.hasAib ? Math.round(totalHt * o.aibRate) : 0
  const netAPayer = totalHt + tva + aib
  const typeLabel = o.docType === 'facture' ? 'FACTURE' : 'DEVIS'
  const verifyUrl = `https://greenflame.africa/verifier/${o.platformRef}`

  const merchantBlock = [
    o.merchant.address ? `${o.merchant.address}${o.merchant.city ? ', ' + o.merchant.city : ''}` : null,
    o.merchant.phone   ? `Tél. : ${o.merchant.phone}` : null,
    o.merchant.ifu     ? `IFU / N° Contribuable : ${o.merchant.ifu}` : null,
    o.merchant.rccm    ? `RCCM : ${o.merchant.rccm}` : null,
  ].filter(Boolean).join('<br>')

  const clientBlock = [
    o.clientPhone   ? `Téléphone : ${o.clientPhone}` : null,
    o.clientAddress ? `Adresse : ${o.clientAddress}` : null,
    o.clientIfu     ? `IFU : ${o.clientIfu}` : null,
  ].filter(Boolean).join('<br>')

  const linesHtml = o.lines.map((l, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9fafb' : ''}">
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#9ca3af;font-size:11px">${i + 1}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">${l.description || '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${l.qty}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">${formatFcfa(l.unitPrice)} FCFA</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">${formatFcfa(l.qty * l.unitPrice)} FCFA</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:11px">${l.unit || 'u'}</td>
    </tr>`).join('')

  const taxRows = `
    <tr>
      <td style="padding:7px 0;color:#6b7280;font-size:12px">Total HT</td>
      <td style="padding:7px 0;text-align:right;font-weight:600;white-space:nowrap">${formatFcfa(totalHt)} FCFA</td>
    </tr>
    ${o.hasTva ? `<tr>
      <td style="padding:7px 0;color:#6b7280;font-size:12px">TVA (18%)</td>
      <td style="padding:7px 0;text-align:right;white-space:nowrap">${formatFcfa(tva)} FCFA</td>
    </tr>` : ''}
    ${o.hasAib ? `<tr>
      <td style="padding:7px 0;color:#6b7280;font-size:12px">AIB (${Math.round(o.aibRate * 100)}%)</td>
      <td style="padding:7px 0;text-align:right;white-space:nowrap">${formatFcfa(aib)} FCFA</td>
    </tr>` : ''}`

  const conditionsHtml = (o.paymentMode || o.paymentCoords || o.paymentDelay) ? `
    <div style="margin-top:20px">
      <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Conditions de paiement</div>
      <ul style="padding-left:18px;line-height:2.2;font-size:11px;color:#4b5563">
        ${o.paymentMode   ? `<li>Mode de paiement : ${o.paymentMode}</li>` : ''}
        ${o.paymentCoords ? `<li>Coordonnées : ${o.paymentCoords}</li>` : ''}
        ${o.paymentDelay  ? `<li>Délai : ${o.paymentDelay}</li>` : ''}
      </ul>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${typeLabel} ${o.num}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1a1a1a; font-size:12px; background:#fff }
  @media print { @page { margin:0; size:A4 } }
</style>
</head>
<body style="position:relative">

${o.paid ? `<div style="position:absolute;top:100px;right:52px;border:4px solid #16a34a;color:#16a34a;font-size:24px;font-weight:900;padding:7px 16px;border-radius:6px;transform:rotate(-18deg);opacity:.18;pointer-events:none;letter-spacing:2px">PAYÉ</div>` : ''}

<div style="background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);height:5px"></div>

<div style="padding:40px 48px">

  <!-- ENTÊTE -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #e5e7eb">
    <div>
      <div style="font-size:21px;font-weight:800;color:#166534;letter-spacing:-.3px">🔥 ${o.merchant.businessName}</div>
      ${merchantBlock ? `<div style="color:#6b7280;font-size:10.5px;margin-top:8px;line-height:2">${merchantBlock}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="display:inline-block;background:#166534;color:#fff;font-size:18px;font-weight:900;padding:5px 18px;border-radius:5px;letter-spacing:2px">${typeLabel}</div>
      <div style="margin-top:10px;font-size:13px;font-weight:700;color:#111">N° ${o.num}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:2">
        Date d'émission : ${o.today}
        ${o.dueDate ? `<br>Date d'échéance : <strong style="color:#166534">${o.dueDate}</strong>` : ''}
      </div>
    </div>
  </div>

  <!-- CLIENT -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
    <div style="font-size:9px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Client / Destinataire</div>
    <div style="font-size:15px;font-weight:700;color:#111">${o.clientName || '—'}</div>
    ${clientBlock ? `<div style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.9">${clientBlock}</div>` : ''}
  </div>

  <!-- LIGNES -->
  <p style="font-size:10.5px;color:#9ca3af;margin-bottom:10px;font-style:italic">
    ${o.docType === 'facture' ? 'Facture émise au titre de la vente / prestation suivante :' : 'Devis établi pour la prestation suivante :'}
  </p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:#166534">
        <th style="padding:10px 12px;text-align:left;font-size:10px;color:#fff;font-weight:700;width:36px">N°</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;color:#fff;font-weight:700">Désignation</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;color:#fff;font-weight:700;width:48px">Qté</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;width:110px">Prix unit. HT</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;width:110px">Montant HT</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;color:#fff;font-weight:700;width:52px">Unité</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <!-- RÉCAPITULATIF FISCAL -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:6px">
    <div style="width:290px">
      <table style="width:100%;border-collapse:collapse">
        <tbody>${taxRows}</tbody>
      </table>
      <div style="background:#166534;color:#fff;padding:12px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span style="font-size:13px;font-weight:700;letter-spacing:.03em">NET À PAYER</span>
        <span style="font-size:16px;font-weight:900;white-space:nowrap">${formatFcfa(netAPayer)} FCFA</span>
      </div>
    </div>
  </div>

  <!-- NOTE FISCALE -->
  <p style="font-size:10px;color:#9ca3af;font-style:italic;margin:18px 0 14px;line-height:1.7">
    <strong style="color:#6b7280">Taxes :</strong> indicatives selon le régime fiscal (TVA 18%, AIB, TPU, ou exonération).
    ${o.hasAib ? `AIB ${Math.round(o.aibRate * 100)}% appliqué${o.merchant.ifu ? ' — IFU valide' : ' — sans IFU'}.` : ''}
  </p>

  ${o.notes ? `<div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 16px;margin:16px 0;font-size:11px;color:#4b5563;border-radius:0 6px 6px 0"><strong style="color:#374151">Notes :</strong> ${o.notes}</div>` : ''}

  ${conditionsHtml}

  <!-- PIED DE PAGE -->
  <div style="margin-top:40px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div>
      <div style="font-size:10px;font-weight:700;color:#374151;margin-bottom:4px">Document sécurisé via GreenFlame Africa</div>
      <div style="font-size:10px;color:#9ca3af">Réf. plateforme : <strong style="color:#374151">${o.platformRef}</strong></div>
    </div>
    <div style="text-align:right">
      <a href="${verifyUrl}" style="font-size:10px;color:#16a34a;text-decoration:none;font-weight:600">Vérifier ce document →</a>
      <div style="font-size:9px;color:#9ca3af;margin-top:2px">${verifyUrl}</div>
    </div>
  </div>

  <p style="margin-top:20px;font-size:11px;font-style:italic;color:#9ca3af;text-align:center">Merci de votre confiance.</p>

</div>
</body></html>`
}

// ── Composant principal ─────────────────────────────────────────────

export default function FactureClient({
  isPro,
  merchant,
  products,
}: {
  isPro:     boolean
  merchant:  MerchantProfile
  products:  CatalogProduct[]
}) {
  // Type de document
  const [docType, setDocType] = useState<DocType>('facture')

  // Numéro et compteur
  const [docNum, setDocNum]       = useState('')
  const [usedCount, setUsedCount] = useState(0)

  // Client
  const [clientName, setClientName]     = useState('')
  const [clientPhone, setClientPhone]   = useState('')
  const [clientIfu, setClientIfu]       = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [dueDate, setDueDate]           = useState('')

  // Lignes
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: 1, unitPrice: 0, unit: 'u' }])

  // Fiscal
  const aibRate = merchant.ifu ? 0.01 : 0.05
  const [hasTva, setHasTva] = useState(false)
  const [hasAib, setHasAib] = useState(false)

  // Conditions de paiement
  const [paymentMode, setPaymentMode]     = useState('')
  const [paymentCoords, setPaymentCoords] = useState('')
  const [paymentDelay, setPaymentDelay]   = useState('')

  // Notes
  const [notes, setNotes] = useState('')

  // Catalogue produits
  const [pickerTarget, setPickerTarget] = useState<number | 'new' | null>(null)
  const [productSearch, setProductSearch] = useState('')

  // Historique
  const [history, setHistory]           = useState<Doc[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [savingDoc, setSavingDoc]       = useState(false)
  const [busyId, setBusyId]             = useState<string | null>(null)

  // Calculs fiscaux
  const totalHt   = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines])
  const tva       = hasTva ? Math.round(totalHt * 0.18) : 0
  const aib       = hasAib ? Math.round(totalHt * aibRate) : 0
  const netAPayer = totalHt + tva + aib

  const remaining      = FREE_LIMIT - usedCount
  const isLimitReached = !isPro && remaining <= 0

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/documents?type=${docType}`)
      if (res.ok) setHistory(await res.json())
    } catch { /* silent */ }
    finally { setLoadingHistory(false) }
  }, [docType])

  useEffect(() => {
    setDocNum(nextDocNumber(docType))
    setUsedCount(getUsedCount())
    loadHistory()
    const p = new URLSearchParams(window.location.search)
    const amt = parseInt(p.get('amount') ?? '0')
    if (amt > 0) setLines([{ description: '', qty: 1, unitPrice: amt, unit: 'u' }])
  }, [docType, loadHistory])

  // ── Lignes ───────────────────────────────────────────────────────

  function addLine() {
    setLines(prev => [...prev, { description: '', qty: 1, unitPrice: 0, unit: 'u' }])
  }
  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateLine(i: number, field: keyof Line, val: string | number) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  // ── Catalogue produits ───────────────────────────────────────────

  function addFromCatalog(p: CatalogProduct) {
    const filled: Line = {
      description: [p.emoji, p.name].filter(Boolean).join(' ').trim(),
      qty:         1,
      unitPrice:   p.priceFcfa,
      unit:        'u',
    }
    if (typeof pickerTarget === 'number') {
      setLines(prev => prev.map((l, i) => i === pickerTarget ? filled : l))
    } else {
      setLines(prev => [...prev, filled])
    }
    setPickerTarget(null)
    setProductSearch('')
  }

  // ── Générer & enregistrer ────────────────────────────────────────

  async function generateAndSave() {
    if (isLimitReached || netAPayer === 0 || savingDoc) return
    setSavingDoc(true)
    const num = docNum || nextDocNumber(docType)

    try {
      const res = await fetch('/api/documents', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:            docType,
          document_number: num,
          status:          'envoye',
          client_name:     clientName || 'Client',
          client_phone:    clientPhone || null,
          client_ifu:      clientIfu.trim() || null,
          client_address:  clientAddress.trim() || null,
          issue_date:      new Date().toISOString().slice(0, 10),
          due_date:        dueDate || null,
          has_tva:         hasTva,
          aib_rate:        hasAib ? aibRate : 0,
          notes:           notes || null,
          lines:           lines.map(l => ({
            description:    l.description,
            quantity:       l.qty,
            unit_price_fcfa: l.unitPrice,
            unit:           l.unit,
          })),
        }),
      })

      if (res.ok) {
        const saved: Doc = await res.json()
        setHistory(prev => [saved, ...prev])
        toast.success(`${docType === 'facture' ? 'Facture' : 'Devis'} ${num} enregistré`)

        // Imprimer avec le platform_ref retourné par l'API
        openPrintWindow(buildHtml({
          docType,
          num,
          today:         new Date().toLocaleDateString('fr-FR'),
          dueDate:       dueDate ? new Date(dueDate).toLocaleDateString('fr-FR') : '',
          merchant,
          clientName:    clientName || 'Client',
          clientPhone,
          clientIfu,
          clientAddress,
          lines,
          hasTva,
          hasAib,
          aibRate,
          paymentMode,
          paymentCoords,
          paymentDelay,
          notes,
          platformRef:   saved.platform_ref ?? num,
          paid:          false,
        }))

        if (!isPro) {
          const cnt = incrementUsed()
          setUsedCount(cnt)
        }
        setDocNum(nextDocNumber(docType))
        setClientName(''); setClientPhone(''); setClientIfu(''); setClientAddress('')
        setDueDate(''); setNotes(''); setPaymentMode(''); setPaymentCoords(''); setPaymentDelay('')
        setLines([{ description: '', qty: 1, unitPrice: 0, unit: 'u' }])
        setHasTva(false); setHasAib(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur réseau — réessayez')
    } finally {
      setSavingDoc(false)
    }
  }

  function openPrintWindow(html: string) {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  function reprint(doc: Doc) {
    openPrintWindow(buildHtml({
      docType:      doc.type,
      num:          doc.document_number,
      today:        new Date(doc.issue_date).toLocaleDateString('fr-FR'),
      dueDate:      doc.due_date ? new Date(doc.due_date).toLocaleDateString('fr-FR') : '',
      merchant,
      clientName:   doc.client_name,
      clientPhone:  doc.client_phone ?? '',
      clientIfu:    doc.client_ifu ?? '',
      clientAddress: doc.client_address ?? '',
      lines:        doc.commercial_document_lines.map(l => ({
        description: l.description,
        qty:         l.quantity,
        unitPrice:   l.unit_price_fcfa,
        unit:        l.unit || 'u',
      })),
      hasTva:       doc.has_tva,
      hasAib:       doc.aib_rate > 0,
      aibRate:      doc.aib_rate || aibRate,
      paymentMode:  '', paymentCoords: '', paymentDelay: '',
      notes:        doc.notes ?? '',
      platformRef:  doc.platform_ref ?? doc.document_number,
      paid:         doc.status === 'paye',
    }))
  }

  async function changeStatus(doc: Doc, status: DocStatus) {
    setBusyId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setHistory(prev => prev.map(d => d.id === doc.id ? updated : d))
        toast.success(`${STATUS_CFG[status].icon} ${STATUS_CFG[status].label}`)
      } else {
        toast.error('Erreur de mise à jour')
      }
    } finally { setBusyId(null) }
  }

  const totalEncaisse   = history.filter(d => d.status === 'paye').reduce((s, d) => s + d.total_fcfa, 0)
  const totalEnAttente  = history.filter(d => ['envoye', 'en_retard'].includes(d.status)).reduce((s, d) => s + d.total_fcfa, 0)

  // ── Rendu ────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 pb-10">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Documents commerciaux</h1>
        <Link href="/merchant/tools" className="text-sm text-brand-600 hover:text-brand-700">← Outils</Link>
      </div>

      {/* Toggle Facture / Devis */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {(['facture', 'devis'] as DocType[]).map(t => (
          <button
            key={t}
            onClick={() => setDocType(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              docType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'facture' ? '🧾 Facture' : '📋 Devis'}
          </button>
        ))}
      </div>

      {/* Bandeau Pro / Free */}
      {isPro ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">PRO</span>
          <span className="text-amber-700 text-xs">Documents illimités</span>
        </div>
      ) : isLimitReached ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-red-700 text-sm font-semibold">Limite mensuelle atteinte</p>
            <p className="text-red-500 text-xs mt-0.5">{usedCount}/{FREE_LIMIT} documents ce mois</p>
          </div>
          <Link href="/merchant/upgrade" className="shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl">
            Passer Pro
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
          <span className="text-brand-700 text-xs">{remaining} document{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} ce mois</span>
          <Link href="/merchant/upgrade" className="text-brand-600 text-xs font-semibold underline underline-offset-2">Passer Pro →</Link>
        </div>
      )}

      {isLimitReached ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-4xl">🧾</p>
          <p className="font-semibold text-gray-700">Débloquez les documents illimités</p>
          <Link href="/merchant/upgrade" className="inline-block bg-brand-600 text-white font-bold px-6 py-3 rounded-xl">
            Voir les offres
          </Link>
        </div>
      ) : (
        <>
          {/* Numéro auto */}
          <div className="card bg-brand-50 border-brand-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-500 font-bold uppercase tracking-widest">Référence document</p>
                <p className="text-brand-700 text-lg font-bold mt-0.5">{docNum || '—'}</p>
              </div>
              <p className="text-xs text-brand-400">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* ── SECTION CLIENT ── */}
          <div className="card space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Client / Destinataire</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Nom / Raison sociale *</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Nom du client" className="input" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Téléphone</label>
                <PhoneInput value={clientPhone} onChange={setClientPhone} placeholder="97 00 00 00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">IFU client <span className="text-gray-400 font-normal">(optionnel — B2B)</span></label>
                <input value={clientIfu} onChange={e => setClientIfu(e.target.value)}
                  placeholder="N° contribuable" className="input" />
              </div>
              <div>
                <label className="label">Adresse <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                  placeholder="Adresse du client" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date d&apos;échéance</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)} className="input" />
              </div>
            </div>
          </div>

          {/* ── SECTION LIGNES ── */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lignes de {docType}</p>
              {products.length > 0 && (
                <button
                  onClick={() => { setPickerTarget('new'); setProductSearch('') }}
                  className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1"
                >
                  <span>📦</span> Depuis la boutique
                </button>
              )}
            </div>

            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  {/* Description + bouton catalogue */}
                  <div className="flex items-center gap-2">
                    <input
                      value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Description du produit ou service"
                      className="input flex-1 text-sm"
                    />
                    {products.length > 0 && (
                      <button
                        onClick={() => { setPickerTarget(i); setProductSearch('') }}
                        title="Choisir depuis la boutique"
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:border-brand-400 text-gray-400 hover:text-brand-600 transition-colors"
                      >
                        📦
                      </button>
                    )}
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors text-lg font-bold">
                        ×
                      </button>
                    )}
                  </div>
                  {/* Qté + Prix + Unité */}
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <label className="label text-[10px]">Qté</label>
                      <input type="number" min="1" value={line.qty}
                        onChange={e => updateLine(i, 'qty', parseInt(e.target.value) || 1)}
                        className="input text-sm text-center" />
                    </div>
                    <div className="flex-1">
                      <label className="label text-[10px]">Prix unitaire HT (FCFA)</label>
                      <input type="number" min="0" value={line.unitPrice || ''}
                        onChange={e => updateLine(i, 'unitPrice', parseInt(e.target.value) || 0)}
                        placeholder="0" className="input text-sm text-right" />
                    </div>
                    <div className="w-24">
                      <label className="label text-[10px]">Unité</label>
                      <select value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)}
                        className="input text-sm">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="text-right shrink-0 pt-5">
                      <p className="text-xs text-gray-500 font-semibold">{formatFcfa(line.qty * line.unitPrice)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addLine}
              className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-brand-600 font-medium hover:border-brand-400 hover:bg-brand-50 transition-colors">
              + Ajouter une ligne
            </button>
          </div>

          {/* ── SECTION FISCALE ── */}
          <div className="card space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Taxes applicables</p>

            <div className="space-y-2">
              <FiscalToggle
                label="TVA (18%)"
                detail={hasTva ? `+ ${formatFcfa(tva)} FCFA` : 'Non assujetti'}
                checked={hasTva}
                onChange={setHasTva}
              />
              <FiscalToggle
                label={`AIB (${Math.round(aibRate * 100)}% — ${merchant.ifu ? 'IFU valide' : 'sans IFU'})`}
                detail={hasAib ? `+ ${formatFcfa(aib)} FCFA` : 'Non appliqué'}
                checked={hasAib}
                onChange={setHasAib}
              />
            </div>

            {/* Récapitulatif */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <TaxRow label="Total HT" value={formatFcfa(totalHt)} />
              {hasTva && <TaxRow label="TVA (18%)" value={`+ ${formatFcfa(tva)}`} />}
              {hasAib && <TaxRow label={`AIB (${Math.round(aibRate * 100)}%)`} value={`+ ${formatFcfa(aib)}`} />}
              <div className="flex justify-between items-center bg-brand-600 text-white px-4 py-3 rounded-xl">
                <span className="font-bold">NET À PAYER</span>
                <span className="text-xl font-bold">{formatFcfa(netAPayer)} FCFA</span>
              </div>
            </div>
          </div>

          {/* ── CONDITIONS DE PAIEMENT ── */}
          <div className="card space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Conditions de paiement <span className="font-normal text-gray-400 normal-case">(optionnel)</span></p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Mode de paiement</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="input">
                  <option value="">— Non précisé —</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                </select>
              </div>
              {paymentMode && (
                <div>
                  <label className="label">Coordonnées de paiement</label>
                  <input value={paymentCoords} onChange={e => setPaymentCoords(e.target.value)}
                    placeholder={paymentMode === 'Mobile Money' ? 'Numéro MTN / Moov' : 'RIB ou référence'}
                    className="input" />
                </div>
              )}
              <div>
                <label className="label">Délai de règlement</label>
                <select value={paymentDelay} onChange={e => setPaymentDelay(e.target.value)} className="input">
                  <option value="">— Non précisé —</option>
                  <option value="À réception">À réception</option>
                  <option value="7 jours">7 jours</option>
                  <option value="15 jours">15 jours</option>
                  <option value="30 jours">30 jours</option>
                  <option value="45 jours">45 jours</option>
                  <option value="60 jours">60 jours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <label className="label">Notes libres</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="input resize-none mt-1"
              placeholder="Conditions particulières, mentions légales, remerciements…" />
          </div>

          {/* CTA */}
          <button
            onClick={generateAndSave}
            disabled={netAPayer === 0 || savingDoc}
            className="btn-primary"
          >
            {savingDoc
              ? 'Enregistrement…'
              : `Générer & imprimer ${docType === 'facture' ? 'la facture' : 'le devis'}`}
          </button>
          <p className="text-center text-xs text-gray-400 -mt-2">
            Le document est enregistré dans l&apos;historique et s&apos;ouvre dans un nouvel onglet pour l&apos;impression.
          </p>
        </>
      )}

      {/* ── HISTORIQUE ── */}
      <div className="pt-2 space-y-3">
        <h2 className="font-semibold text-gray-900">
          Historique {docType === 'facture' ? 'des factures' : 'des devis'}
        </h2>

        {!loadingHistory && history.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs text-gray-400">Encaissé</p>
              <p className="font-bold text-green-600 text-lg mt-0.5">{formatFcfa(totalEncaisse)} FCFA</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400">En attente</p>
              <p className="font-bold text-orange-500 text-lg mt-0.5">{formatFcfa(totalEnAttente)} FCFA</p>
            </div>
          </div>
        )}

        {loadingHistory && <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>}

        {!loadingHistory && history.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">🧾</p>
            <p className="text-gray-500 text-sm">Aucun document pour le moment</p>
          </div>
        )}

        <div className="space-y-3">
          {history.map(doc => {
            const cfg     = STATUS_CFG[doc.status]
            const nexts   = NEXT_STATUS[doc.status] ?? []
            const busy    = busyId === doc.id
            return (
              <div key={doc.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{doc.document_number}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {doc.platform_ref && (
                        <span className="text-[10px] text-gray-400 font-mono">{doc.platform_ref}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {doc.client_name}{doc.client_phone ? ` · ${doc.client_phone}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Émis le {fmtShortDate(doc.issue_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-brand-600 text-sm">{formatFcfa(doc.total_fcfa)}</p>
                    {(doc.has_tva || doc.aib_rate > 0) && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {[doc.has_tva && 'TVA', doc.aib_rate > 0 && 'AIB'].filter(Boolean).join(' + ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-1">
                  {nexts.map(next => (
                    <button
                      key={next}
                      disabled={busy}
                      onClick={() => changeStatus(doc, next)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl border disabled:opacity-50 transition-colors ${STATUS_CFG[next].color}`}
                    >
                      {STATUS_CFG[next].icon} {STATUS_CFG[next].label}
                    </button>
                  ))}
                  <button
                    onClick={() => reprint(doc)}
                    className="text-xs text-gray-600 font-medium px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    🖨️ Réimprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PICKER PRODUITS ── */}
      {pickerTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
          onClick={() => { setPickerTarget(null); setProductSearch('') }}
        >
          <div
            className="bg-white rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <p className="font-bold text-gray-900">Choisir un produit</p>
              <button
                onClick={() => { setPickerTarget(null); setProductSearch('') }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-brand-400"
              />
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun produit trouvé</p>
              ) : filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addFromCatalog(p)}
                  className="w-full flex items-center gap-3 bg-gray-50 hover:bg-brand-50 border border-gray-100 hover:border-brand-200 rounded-xl px-4 py-3 text-left transition-colors"
                >
                  <span className="text-2xl shrink-0">{p.emoji || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  </div>
                  <p className="text-sm font-bold text-brand-600 shrink-0 whitespace-nowrap">
                    {formatFcfa(p.priceFcfa)} FCFA
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sous-composants ─────────────────────────────────────────────────

function FiscalToggle({
  label, detail, checked, onChange,
}: {
  label: string; detail: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
        checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className={`text-sm font-semibold ${checked ? 'text-green-800' : 'text-gray-700'}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${checked ? 'text-green-600' : 'text-gray-400'}`}>{detail}</p>
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </div>
  )
}

function TaxRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-1 py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800 tabular-nums">{value} FCFA</span>
    </div>
  )
}
