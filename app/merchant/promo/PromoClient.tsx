'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

const PACKS = [
  { size: 50,  price: 500, label: '50 messages', desc: '500 FCFA' },
  { size: 100, price: 800, label: '100 messages', desc: '800 FCFA', badge: 'Meilleur rapport' },
]

const MAX_CHARS = 280

interface Props {
  merchantId:   string
  businessName: string
  tierActive:   boolean
  balance:      number
  totalUsed:    number
  walletBalance: number
}

export default function PromoClient({ merchantId, businessName, tierActive, balance: initBalance, totalUsed: initUsed, walletBalance }: Props) {
  const [balance, setBalance] = useState(initBalance)
  const [totalUsed, setTotalUsed] = useState(initUsed)
  const [message, setMessage]     = useState('')
  const [sending, setSending]     = useState(false)
  const [buying, setBuying]       = useState<number | null>(null)
  const [result, setResult]       = useState<{ sent: number; remaining: number } | null>(null)

  void merchantId

  async function handleBuy(size: number) {
    setBuying(size)
    try {
      const res = await fetch('/api/merchant/promo/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_size: size }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      setBalance(data.new_balance)
      toast.success(data.message)
    } finally {
      setBuying(null)
    }
  }

  async function handleSend() {
    if (!message.trim() || balance <= 0) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/merchant/promo/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      setBalance(data.remaining)
      setTotalUsed(prev => prev + data.sent)
      setResult({ sent: data.sent, remaining: data.remaining })
      setMessage('')
      toast.success(data.message)
    } finally {
      setSending(false)
    }
  }

  if (!tierActive) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
        <p className="text-amber-800 font-semibold">Abonnement Pro expiré</p>
        <p className="text-amber-700 text-sm">Renouvelez votre abonnement pour accéder aux messages promotionnels.</p>
        <a href="/merchant/upgrade" className="inline-block mt-2 bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
          Renouveler →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Solde de crédits */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Crédits disponibles</p>
            <p className="text-4xl font-bold text-gray-900 mt-0.5">{balance}</p>
            <p className="text-xs text-gray-400 mt-0.5">{totalUsed} envoyés au total</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-3xl">
            📣
          </div>
        </div>
      </div>

      {/* Achat de pack */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <p className="font-semibold text-gray-900">Acheter des crédits</p>
        <p className="text-xs text-gray-400">
          Wallet boutique disponible : <strong className="text-gray-700">{walletBalance.toLocaleString('fr-FR')} FCFA</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PACKS.map(pack => (
            <div key={pack.size} className="relative border-2 border-gray-100 rounded-xl p-4 space-y-2">
              {pack.badge && (
                <span className="absolute -top-2.5 left-3 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pack.badge}
                </span>
              )}
              <p className="font-bold text-gray-900">{pack.label}</p>
              <p className="text-brand-600 font-semibold text-sm">{pack.desc}</p>
              <button
                onClick={() => handleBuy(pack.size)}
                disabled={!!buying || walletBalance < pack.price}
                className="w-full bg-brand-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {buying === pack.size ? 'Achat en cours…' : 'Acheter'}
              </button>
              {walletBalance < pack.price && (
                <p className="text-[10px] text-red-400 text-center">Solde insuffisant</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Composer et envoyer */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        <p className="font-semibold text-gray-900">Composer un message</p>

        <div>
          <div className="relative">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
              placeholder={`Ex : 🎉 Promo flash chez ${businessName} — -20% ce weekend sur tout le catalogue ! Venez vite.`}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-400 resize-none"
            />
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <p className="text-xs text-gray-400">Destinataires : tous vos acheteurs passés (sauf ceux ayant désactivé vos notifications)</p>
            <span className={`text-xs font-medium ${message.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
              {message.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {balance <= 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Achetez des crédits ci-dessus pour envoyer votre message.
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || balance <= 0}
          className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {sending ? 'Envoi en cours…' : `Envoyer (1 crédit / destinataire)`}
        </button>
      </div>

      {/* Résultat dernier envoi */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-4">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">Message envoyé !</p>
            <p className="text-sm text-green-700">
              {result.sent} destinataire{result.sent > 1 ? 's' : ''} · {result.remaining} crédit{result.remaining > 1 ? 's' : ''} restant{result.remaining > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Note anti-spam */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong>Politique d'envoi :</strong> vos messages arrivent dans la cloche de notifications GreenFlame de chaque acheteur. Les utilisateurs peuvent désactiver vos notifications depuis leur profil. Utilisez ce canal avec parcimonie pour préserver la confiance.
        </p>
      </div>
    </div>
  )
}
