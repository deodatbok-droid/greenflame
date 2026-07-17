'use client'

/**
 * /ucp — Espace Souscription UCP du Leader
 *
 * Affiche les bulletins BSD-UCP reçus et gère le flux
 * de signature en 3 étapes : Acceptation → OTP → PIN.
 */

import { useEffect, useState, useCallback } from 'react'
import BackButton from '@/components/ui/BackButton'

// ── Types ─────────────────────────────────────────────────────────────────────

type BsdStatus = 'pending' | 'user_signed' | 'signed' | 'revoked'

interface Subscription {
  id:               string
  bsd_number:       string
  status:           BsdStatus
  subscription_type:'purchase' | 'attribution'
  ucp_parts:        number
  amount_fcfa:      number
  pdf_url:          string | null
  created_at:       string
  accepted_at:      string | null
  otp_verified_at:  string | null
  pin_verified_at:  string | null
  confirmed_at:     string | null
}

type SignStep = 'idle' | 'accept' | 'otp' | 'pin' | 'done'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BsdStatus, { label: string; color: string; icon: string }> = {
  pending:     { label: 'En attente de signature', color: 'bg-amber-100 text-amber-700',   icon: '⏳' },
  user_signed: { label: 'Signé — confirmation en cours', color: 'bg-blue-100 text-blue-700',   icon: '✍️' },
  signed:      { label: 'Confirmé ✓',              color: 'bg-green-100 text-green-700', icon: '✅' },
  revoked:     { label: 'Révoqué',                  color: 'bg-red-100 text-red-700',    icon: '❌' },
}

function fmt(n: number) { return n.toLocaleString('fr-FR') }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function UcpPage() {
  const [subs,    setSubs]    = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [active,  setActive]  = useState<string | null>(null)  // id du bulletin en cours de signature
  const [step,    setStep]    = useState<SignStep>('idle')
  const [otp,     setOtp]     = useState('')
  const [pin,     setPin]     = useState('')
  const [busy,    setBusy]    = useState(false)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/ucp')
    const data = await res.json()
    setSubs(data.subscriptions ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Action POST sign ──────────────────────────────────────────────────────
  async function sign(id: string, step: 'accept' | 'otp' | 'pin', payload?: Record<string, string>) {
    setBusy(true)
    setMsg(null)
    try {
      const res  = await fetch('/api/ucp/sign', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, step, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ text: data.error ?? 'Erreur', ok: false })
        return false
      }
      setMsg({ text: data.message ?? 'OK', ok: true })
      return true
    } finally {
      setBusy(false)
    }
  }

  // ── Handlers d'étapes ─────────────────────────────────────────────────────
  async function handleAccept(id: string) {
    setActive(id); setStep('accept'); setMsg(null)
    const ok = await sign(id, 'accept')
    if (ok) setStep('otp')
  }

  async function handleOtp() {
    if (!active || !otp.trim()) return
    const ok = await sign(active, 'otp', { code: otp.trim() })
    if (ok) { setOtp(''); setStep('pin') }
  }

  async function handlePin() {
    if (!active || !pin.trim()) return
    const ok = await sign(active, 'pin', { pin: pin.trim() })
    if (ok) {
      setPin(''); setStep('done')
      setTimeout(() => {
        setActive(null); setStep('idle'); setMsg(null); load()
      }, 2000)
    }
  }

  function cancelSign() { setActive(null); setStep('idle'); setMsg(null); setOtp(''); setPin('') }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-6">
        <div className="animate-pulse space-y-4">
          {[1,2].map(i => <div key={i} className="card h-32 bg-gray-100" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-4 pt-10 pb-6 -mx-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <BackButton href="/profile" className="text-brand-200 hover:text-white" />
          <span className="text-white/80 text-sm font-semibold">Parts UCP</span>
          <div className="w-8" />
        </div>
        <h1 className="text-white font-bold text-xl mt-2">Ubuntu Capital Plan</h1>
        <p className="text-brand-200 text-sm mt-1">
          Vos bulletins de souscription de droits sur les futures actions GreenFlame SA
        </p>
      </div>

      {/* Aucun bulletin */}
      {subs.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold text-gray-800">Aucun bulletin émis</p>
          <p className="text-sm text-gray-500 mt-1">
            Vos bulletins BSD-UCP apparaîtront ici dès leur émission par l'administration.
          </p>
        </div>
      )}

      {/* Liste des bulletins */}
      <div className="space-y-4">
        {subs.map(sub => {
          const s       = STATUS_LABEL[sub.status]
          const isActive = active === sub.id

          return (
            <div key={sub.id} className="card space-y-4">
              {/* En-tête bulletin */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{sub.bsd_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Émis le {fmtDate(sub.created_at)}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${s.color}`}>
                  {s.icon} {s.label}
                </span>
              </div>

              {/* Détails */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                  <p className="font-semibold text-gray-900 text-sm mt-0.5">
                    {sub.subscription_type === 'purchase' ? '💳 Achat' : '🎁 Attribution'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Parts UCP</p>
                  <p className="font-bold text-brand-700 text-lg mt-0.5">{fmt(sub.ucp_parts)}</p>
                </div>
                {sub.subscription_type === 'purchase' && sub.amount_fcfa > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Montant</p>
                    <p className="font-semibold text-gray-900 text-sm mt-0.5">
                      {fmt(sub.amount_fcfa)} FCFA
                    </p>
                  </div>
                )}
              </div>

              {/* Progression étapes */}
              {sub.status !== 'revoked' && (
                <div className="flex items-center gap-1 text-[10px]">
                  {[
                    { label: 'Accepté',  done: !!sub.accepted_at },
                    { label: 'OTP',      done: !!sub.otp_verified_at },
                    { label: 'PIN',      done: !!sub.pin_verified_at },
                    { label: 'Confirmé', done: !!sub.confirmed_at },
                  ].map((e, i, arr) => (
                    <div key={e.label} className="flex items-center gap-1 flex-1">
                      <div className={`flex-1 text-center py-1 rounded-full font-semibold ${
                        e.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {e.done ? '✓' : '○'} {e.label}
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`w-4 h-px ${e.done ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {sub.status === 'pending' && !isActive && (
                <button
                  onClick={() => handleAccept(sub.id)}
                  disabled={busy}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-60"
                >
                  ✍️ Signer ce bulletin
                </button>
              )}

              {sub.status === 'user_signed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                  Bulletin signé — en attente de confirmation de paiement par l'administration.
                  Vous recevrez une notification WhatsApp dès validation.
                </div>
              )}

              {sub.status === 'signed' && sub.pdf_url && (
                <a
                  href={`/api/ucp/${sub.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  📄 Télécharger le BSD-UCP
                </a>
              )}

              {/* ── Flux de signature inline ── */}
              {isActive && step !== 'idle' && (
                <div className="border border-brand-200 bg-brand-50 rounded-xl p-4 space-y-3">
                  {step === 'accept' && busy && (
                    <p className="text-sm text-brand-700 text-center animate-pulse">
                      Envoi du code OTP sur WhatsApp…
                    </p>
                  )}

                  {step === 'otp' && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800">
                        Code OTP reçu sur WhatsApp
                      </p>
                      <p className="text-xs text-gray-500">
                        Entrez le code à 6 chiffres envoyé sur votre numéro enregistré.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="• • • • • •"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-brand-400"
                      />
                      <button
                        onClick={handleOtp}
                        disabled={busy || otp.length < 6}
                        className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
                      >
                        {busy ? 'Vérification…' : 'Valider le code'}
                      </button>
                    </div>
                  )}

                  {step === 'pin' && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800">PIN de transaction</p>
                      <p className="text-xs text-gray-500">
                        Entrez votre PIN pour finaliser la signature.
                      </p>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="• • • • • •"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g,''))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-brand-400"
                      />
                      <button
                        onClick={handlePin}
                        disabled={busy || pin.length < 4}
                        className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
                      >
                        {busy ? 'Validation…' : 'Confirmer la signature'}
                      </button>
                    </div>
                  )}

                  {step === 'done' && (
                    <div className="text-center py-4">
                      <p className="text-3xl mb-2">✅</p>
                      <p className="font-bold text-green-700">Bulletin signé avec succès !</p>
                      <p className="text-xs text-gray-500 mt-1">
                        En attente de confirmation par l'administration.
                      </p>
                    </div>
                  )}

                  {msg && step !== 'done' && (
                    <p className={`text-xs text-center font-medium ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {msg.text}
                    </p>
                  )}

                  {step !== 'done' && (
                    <button
                      onClick={cancelSign}
                      className="w-full text-gray-400 text-xs py-1 hover:text-gray-600"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Explainer */}
      <div className="mt-6 card bg-gray-50 border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">ℹ️ À propos des parts UCP</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Les parts Ubuntu Capital Plan (UCP) vous confèrent un droit préférentiel sur
          les futures actions GreenFlame SA lors de l'ouverture du capital.
          Ce bulletin est votre titre nominatif jusqu'à la constitution en SA.
        </p>
      </div>
    </div>
  )
}
