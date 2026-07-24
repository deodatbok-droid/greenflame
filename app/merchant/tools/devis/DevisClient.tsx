'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

type Line = { description: string; qty: number; unitPrice: number }

type DocStatus = 'brouillon' | 'envoye' | 'accepte' | 'paye' | 'en_retard' | 'annule'

type DocLine = { id: string; description: string; quantity: number; unit_price_fcfa: number; position: number }

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

const FREE_LIMIT = 5

const DEVIS_NEXT: Record<DocStatus, DocStatus[]> = {
  brouillon: ['envoye', 'annule'],
  envoye:    ['accepte', 'annule'],
  accepte:   ['annule'],
  paye:      [],
  en_retard: [],
  annule:    ['brouillon'],
}

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

export default function DevisClient({
  businessName,
  isPro,
}: {
  businessName: string
  isPro: boolean
}) {
  const { t } = useLocale()

  const STATUS_CONFIG: Record<DocStatus, { label: string; icon: string; classes: string }> = {
    brouillon: { label: t('merchant.devis.statusBrouillon'), icon: '📝', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
    envoye:    { label: t('merchant.devis.statusEnvoye'),    icon: '📤', classes: 'bg-blue-50 text-blue-600 border-blue-200' },
    accepte:   { label: t('merchant.devis.statusAccepte'),   icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
    paye:      { label: t('merchant.devis.statusPaye'),      icon: '💰', classes: 'bg-green-50 text-green-700 border-green-200' },
    en_retard: { label: t('merchant.devis.statusEnRetard'),  icon: '🔴', classes: 'bg-red-50 text-red-600 border-red-200' },
    annule:    { label: t('merchant.devis.statusAnnule'),    icon: '🚫', classes: 'bg-gray-50 text-gray-400 border-gray-200' },
  }

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: 1, unitPrice: 0 }])
  const [notes, setNotes] = useState('')
  const [validDays, setValidDays] = useState(30)
  const [usedCount, setUsedCount] = useState(0)

  const [history, setHistory] = useState<Doc[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [savingDoc, setSavingDoc] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/documents?type=devis')
      if (res.ok) setHistory(await res.json())
    } catch {
      // silent — history is supplementary
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    setUsedCount(getUsedCount())
    loadHistory()
    const params = new URLSearchParams(window.location.search)
    const urlAmount = parseInt(params.get('amount') ?? '0')
    if (urlAmount > 0) {
      setLines([{ description: '', qty: 1, unitPrice: urlAmount }])
    }
  }, [loadHistory])

  const remaining = FREE_LIMIT - usedCount
  const isLimitReached = !isPro && remaining <= 0

  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const today = new Date().toLocaleDateString()
  const expiry = new Date(Date.now() + validDays * 86400000).toLocaleDateString()

  function addLine() { setLines(prev => [...prev, { description: '', qty: 1, unitPrice: 0 }]) }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof Line, value: string | number) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function buildHtml(quoteNum: string) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>${t('merchant.devis.pdfTitle')} ${quoteNum}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1a1a1a; font-size:12px; background:#fff }
  @media print { @page { margin:0; size:A4 } }
</style>
</head>
<body>

<div style="background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);height:5px"></div>

<div style="padding:40px 48px">

  <!-- ENTÊTE -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
    <div>
      <div style="font-size:21px;font-weight:800;color:#166534;letter-spacing:-.3px">🔥 ${businessName}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:5px;letter-spacing:.02em">Bénin · Plateforme GreenFlame Africa</div>
    </div>
    <div style="text-align:right">
      <div style="display:inline-block;background:#166534;color:#fff;font-size:18px;font-weight:900;padding:5px 18px;border-radius:5px;letter-spacing:2px">${t('merchant.devis.pdfTitle')}</div>
      <div style="margin-top:10px;font-size:13px;font-weight:700;color:#111">${quoteNum}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:2">
        ${t('merchant.devis.pdfIssued').replace('{date}', today)}<br>
        ${t('merchant.devis.pdfValidUntil').replace('{date}', expiry)}
      </div>
    </div>
  </div>

  <!-- BADGE VALIDITÉ -->
  <div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:24px">
    <div style="width:8px;height:8px;background:#16a34a;border-radius:50%;flex-shrink:0"></div>
    <span style="font-size:11px;color:#166534;font-weight:600">${t('merchant.devis.pdfValidUntil').replace('{date}', expiry)}</span>
    <span style="font-size:10px;color:#9ca3af;margin-left:auto">${validDays} jours</span>
  </div>

  <!-- CLIENT -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:24px">
    <div style="font-size:9px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">${t('merchant.devis.pdfRecipient')}</div>
    <div style="font-size:15px;font-weight:700;color:#111">${clientName || '—'}</div>
    ${clientPhone ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">${clientPhone}</div>` : ''}
  </div>

  <!-- TABLEAU LIGNES -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#166534">
        <th style="padding:10px 12px;text-align:left;font-size:10px;color:#fff;font-weight:700">${t('merchant.docs.pdfDesc')}</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;color:#fff;font-weight:700;width:60px">${t('merchant.docs.pdfQty')}</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;width:130px">${t('merchant.docs.pdfUnitPrice')}</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;width:130px">${t('merchant.docs.pdfTotal')}</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map((l, i) => `<tr style="${i % 2 === 1 ? 'background:#f9fafb' : ''}">
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:${l.description ? '#111' : '#9ca3af'}">${l.description || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${l.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;color:#374151">${formatFcfa(l.unitPrice)} FCFA</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">${formatFcfa(l.qty * l.unitPrice)} FCFA</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- TOTAL -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:260px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e5e7eb">
        <span style="font-size:11px;color:#6b7280">Sous-total</span>
        <span style="font-size:11px;font-weight:600;white-space:nowrap">${formatFcfa(total)} FCFA</span>
      </div>
      <div style="background:#166534;color:#fff;padding:11px 14px;border-radius:5px;display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span style="font-size:12px;font-weight:700">${t('merchant.docs.pdfTotalTtc')}</span>
        <span style="font-size:15px;font-weight:900;white-space:nowrap">${formatFcfa(total)} FCFA</span>
      </div>
    </div>
  </div>

  ${notes ? `<div style="background:#f9fafb;border-left:3px solid #16a34a;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;font-size:11px;color:#4b5563"><strong style="color:#374151">${t('merchant.docs.pdfNotesLabel')}</strong> ${notes}</div>` : ''}

  <!-- SIGNATURES -->
  <div style="display:flex;gap:20px;margin-top:40px;margin-bottom:24px">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Émis par</div>
      <div style="font-size:13px;font-weight:700;color:#111">${businessName}</div>
      <div style="height:36px;border-bottom:1px dashed #d1d5db;margin-top:20px"></div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px">Signature / Cachet</div>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Bon pour accord</div>
      <div style="font-size:13px;font-weight:700;color:#111">${clientName || '—'}</div>
      <div style="height:36px;border-bottom:1px dashed #d1d5db;margin-top:20px"></div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px">Signature · Date</div>
    </div>
  </div>

  <!-- PIED DE PAGE -->
  <div style="padding-top:14px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:10px;color:#9ca3af">${t('merchant.devis.pdfFooter')}</p>
  </div>

</div>
</body></html>`
  }

  async function generateAndSave() {
    if (isLimitReached || total === 0 || savingDoc) return
    setSavingDoc(true)
    const quoteNum = `DEV-${Date.now().toString(36).toUpperCase()}`

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'devis',
          document_number: quoteNum,
          status: 'envoye',
          client_name: clientName || 'Client',
          client_phone: clientPhone || null,
          issue_date: new Date().toISOString().slice(0, 10),
          valid_until: new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10),
          notes: notes || null,
          lines: lines.map(l => ({ description: l.description, quantity: l.qty, unit_price_fcfa: l.unitPrice })),
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        setHistory(prev => [saved, ...prev])
        toast.success(t('merchant.devis.savedToast').replace('{num}', quoteNum))
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? t('merchant.devis.saveError'))
      }
    } catch {
      toast.error(t('merchant.devis.offlineError'))
    } finally {
      setSavingDoc(false)
    }

    const w = window.open('', '_blank')
    if (w) {
      w.document.write(buildHtml(quoteNum))
      w.document.close()
      w.print()
    }
    if (!isPro) {
      const newCount = incrementUsed()
      setUsedCount(newCount)
    }
  }

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
        toast.success(t('merchant.devis.statusChanged').replace('{num}', doc.document_number).replace('{label}', STATUS_CONFIG[status].label))
      } else {
        toast.error(t('merchant.docs.updateFailed'))
      }
    } finally {
      setBusyId(null)
    }
  }

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
            description: l.description, quantity: l.quantity, unit_price_fcfa: l.unit_price_fcfa,
          })),
        }),
      })
      if (res.ok) {
        await fetch(`/api/documents/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepte', linked_document_id: null }),
        })
        toast.success(t('merchant.devis.convertSuccess').replace('{num}', factureNum))
        loadHistory()
      } else {
        toast.error(t('merchant.devis.convertError'))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('merchant.devis.title')}</h1>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.docs.back')}</Link>
      </div>

      {isPro ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{t('merchant.docs.proBadge')}</span>
          <span className="text-amber-700 text-xs">{t('merchant.devis.proUnlimited')}</span>
        </div>
      ) : isLimitReached ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-red-700 text-sm font-semibold">{t('merchant.docs.limitReached')}</p>
            <p className="text-red-500 text-xs mt-0.5">{t('merchant.devis.limitUsed').replace('{used}', String(usedCount)).replace('{max}', String(FREE_LIMIT))}</p>
          </div>
          <Link href="/merchant/upgrade" className="flex-shrink-0 bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            {t('merchant.docs.upgradePro')}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
          <span className="text-brand-700 text-xs">
            {t('merchant.devis.freeRemaining').replace('{n}', String(remaining)).replace('{s}', remaining > 1 ? 's' : '')}
          </span>
          <Link href="/merchant/upgrade" className="text-brand-600 text-xs font-semibold underline underline-offset-2">
            {t('merchant.docs.upgradeCta')}
          </Link>
        </div>
      )}

      {isLimitReached ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-4xl">📄</p>
          <p className="font-semibold text-gray-700">{t('merchant.devis.upsellTitle')}</p>
          <p className="text-sm text-gray-400">{t('merchant.docs.upsellDesc')}</p>
          <Link href="/merchant/upgrade" className="inline-block bg-brand-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">
            {t('merchant.docs.seeOffers')}
          </Link>
        </div>
      ) : (
        <>
          <div className="card space-y-4">
            <p className="font-semibold text-gray-700 text-sm">{t('merchant.docs.clientSection')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('merchant.docs.clientName')}</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder={t('merchant.docs.clientNamePlaceholder')} className="input" />
              </div>
              <div>
                <label className="label">{t('merchant.docs.clientPhone')}</label>
                <PhoneInput value={clientPhone} onChange={setClientPhone} placeholder="97 00 00 00" />
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <p className="font-semibold text-gray-700 text-sm">{t('merchant.devis.linesSection')}</p>
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    value={line.description}
                    onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder={t('merchant.devis.descPlaceholder')}
                    className="input text-sm"
                  />
                </div>
                <div className="w-16">
                  <input
                    type="number" min="1"
                    value={line.qty}
                    onChange={e => updateLine(i, 'qty', parseInt(e.target.value) || 1)}
                    className="input text-sm text-center"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number" min="0"
                    value={line.unitPrice || ''}
                    onChange={e => updateLine(i, 'unitPrice', parseInt(e.target.value) || 0)}
                    placeholder="FCFA"
                    className="input text-sm text-right"
                  />
                </div>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-lg mt-2">×</button>
                )}
              </div>
            ))}
            <button onClick={addLine} className="text-brand-600 text-sm font-medium hover:text-brand-700">{t('merchant.docs.addLine')}</button>
          </div>

          <div className="card space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">{t('merchant.docs.notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input resize-none" placeholder={t('merchant.devis.notesPlaceholder')} />
              </div>
              <div className="w-28">
                <label className="label">{t('merchant.devis.validDays')}</label>
                <input type="number" min="1" value={validDays} onChange={e => setValidDays(parseInt(e.target.value) || 30)} className="input text-center" />
              </div>
            </div>
            <div className="flex justify-between items-center bg-brand-50 rounded-xl px-4 py-3">
              <span className="font-semibold text-gray-700">{t('merchant.devis.total')}</span>
              <span className="text-xl font-bold text-brand-700">{formatFcfa(total)} FCFA</span>
            </div>
          </div>

          <button onClick={generateAndSave} disabled={total === 0 || savingDoc} className="btn-primary">
            {savingDoc ? t('merchant.docs.saving') : t('merchant.devis.generateBtn')}
          </button>
          <p className="text-center text-xs text-gray-400 -mt-2">{t('merchant.devis.historyHint')}</p>
        </>
      )}

      <div className="pt-2">
        <h2 className="font-semibold text-gray-900 mb-3">{t('merchant.devis.historyTitle')}</h2>

        {loadingHistory && <p className="text-sm text-gray-400 text-center py-6">{t('merchant.docs.loading')}</p>}

        {!loadingHistory && history.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">📄</p>
            <p className="text-gray-500 text-sm">{t('merchant.devis.historyEmpty')}</p>
          </div>
        )}

        <div className="space-y-3">
          {history.map((doc) => {
            const cfg = STATUS_CONFIG[doc.status]
            const nextOptions = DEVIS_NEXT[doc.status] ?? []
            const busy = busyId === doc.id
            return (
              <div key={doc.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{doc.document_number}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.classes}`}>{cfg.icon} {cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {doc.client_name}{doc.client_phone ? ` · ${doc.client_phone}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('merchant.devis.issuedOn').replace('{date}', new Date(doc.issue_date).toLocaleDateString())}
                      {doc.valid_until ? ` · ${t('merchant.devis.validUntil').replace('{date}', new Date(doc.valid_until).toLocaleDateString())}` : ''}
                    </p>
                  </div>
                  <p className="font-bold text-brand-600 text-sm flex-shrink-0">{formatFcfa(doc.total_fcfa)}</p>
                </div>

                <div className="flex gap-2 flex-wrap pt-1">
                  {nextOptions.map((next) => (
                    <button
                      key={next}
                      disabled={busy}
                      onClick={() => changeStatus(doc, next)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl border ${STATUS_CONFIG[next].classes} disabled:opacity-50`}
                    >
                      {STATUS_CONFIG[next].icon} {t('merchant.docs.markAs').replace('{label}', STATUS_CONFIG[next].label)}
                    </button>
                  ))}
                  {doc.status === 'accepte' && (
                    <button
                      disabled={busy}
                      onClick={() => convertToFacture(doc)}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-600 text-white disabled:opacity-50"
                    >
                      {t('merchant.devis.convertBtn')}
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
