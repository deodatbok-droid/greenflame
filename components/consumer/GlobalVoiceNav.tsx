'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useVoice, speak } from '@/lib/hooks/useVoice'
import {
  parseVoiceCommand,
  CONSUMER_VOICE_HINTS,
  MERCHANT_VOICE_HINTS,
  ADMIN_VOICE_HINTS,
} from '@/lib/utils/voiceParser'
import type { VoiceAction as ParsedAction } from '@/lib/utils/voiceParser'
import toast from 'react-hot-toast'

// Shape returned by /api/voice/interpret (LLM)
type LlmAction = {
  action: 'navigate' | 'pay' | 'receive' | 'search' | 'budget_entry' | 'create_product' | 'query_balance' | 'query_score' | 'back' | 'help' | 'unknown'
  data: Record<string, unknown>
  reply: string
  confidence: number
}

type Context = 'consumer' | 'merchant' | 'admin'

function getContext(pathname: string): Context {
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/admin'))    return 'admin'
  return 'consumer'
}

const CONTEXT_LABELS: Record<Context, string> = {
  consumer: 'Client',
  merchant: 'Marchand',
  admin:    'Admin',
}

const CONTEXT_COLORS: Record<Context, string> = {
  consumer: 'bg-brand-600',
  merchant: 'bg-amber-600',
  admin:    'bg-gray-700',
}

const EXAMPLE_COMMANDS: Record<Context, { label: string; example: string }[]> = {
  consumer: [
    { label: '"Emmène-moi voir les pagnes wax"',     example: '→ recherche pagnes wax' },
    { label: '"J\'ai dépensé 2500 en zémidjan"',     example: '→ dépense enregistrée' },
    { label: '"Quel est mon solde ?"',                example: '→ lecture du portefeuille' },
    { label: '"Payer cinq mille francs"',             example: '→ paiement 5 000 FCFA' },
    { label: '"Montre-moi mon score"',                example: '→ score GreenFlame' },
  ],
  merchant: [
    { label: '"Encaisser trois mille"',               example: '→ caisse 3 000 FCFA' },
    { label: '"Crée un produit sauce tomate 500f"',   example: '→ formulaire pré-rempli' },
    { label: '"Devis cinq mille"',                    example: '→ devis 5 000 FCFA' },
    { label: '"Mon chiffre d\'affaires"',             example: '→ analytics' },
  ],
  admin: [
    { label: '"Réconciliation"',   example: '→ page float' },
    { label: '"Les marchands"',    example: '→ liste marchands' },
    { label: '"KYC"',              example: '→ vérifications' },
  ],
}

export default function GlobalVoiceNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const [open,        setOpen]        = useState(false)
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [feedback,    setFeedback]    = useState<{ text: string; ok: boolean } | null>(null)
  const [processing,  setProcessing]  = useState(false)

  const context  = getContext(pathname)
  const hints    = context === 'admin' ? ADMIN_VOICE_HINTS : context === 'merchant' ? MERCHANT_VOICE_HINTS : CONSUMER_VOICE_HINTS
  const headerBg = CONTEXT_COLORS[context]
  const ctxLabel = CONTEXT_LABELS[context]
  const examples = EXAMPLE_COMMANDS[context]

  // ─── Gestionnaire d'action parsée (parser de mots-clés, 0ms) ────────────────
  function applyParsedAction(action: ParsedAction) {
    switch (action.type) {
      case 'navigate':
        if (pathname === action.path) {
          setFeedback({ text: `Déjà sur ${action.label}`, ok: true })
          speak(`Vous êtes déjà sur ${action.label}`)
        } else {
          setFeedback({ text: `→ ${action.label}`, ok: true })
          speak(`${action.label}`)
          setOpen(false)
          router.push(action.path)
        }
        break
      case 'pay':
        setFeedback({ text: `Payer ${action.amount.toLocaleString('fr-FR')} FCFA →`, ok: true })
        speak(`Paiement de ${action.amount.toLocaleString('fr-FR')} francs`)
        setOpen(false)
        router.push(`/pay?amount=${action.amount}`)
        break
      case 'receive': {
        const url = action.amount ? `/merchant/receive?amount=${action.amount}` : '/merchant/receive'
        speak(action.amount ? `Encaissement de ${action.amount.toLocaleString('fr-FR')} francs` : 'Caisse')
        setFeedback({ text: action.amount ? `Encaisser ${action.amount.toLocaleString('fr-FR')} FCFA →` : 'Caisse →', ok: true })
        setOpen(false)
        router.push(url)
        break
      }
      case 'search':
        setFeedback({ text: `Chercher "${action.query}" →`, ok: true })
        speak(`Recherche de ${action.query}`)
        setOpen(false)
        router.push(`/marketplace?q=${encodeURIComponent(action.query)}`)
        break
      case 'add_product':
        setFeedback({ text: 'Nouveau produit →', ok: true })
        speak('Formulaire nouveau produit')
        setOpen(false)
        router.push('/merchant/products?action=new')
        break
      case 'new_quote': {
        const url = action.amount ? `/merchant/tools/devis?amount=${action.amount}` : '/merchant/tools/devis'
        speak(action.amount ? `Devis de ${action.amount.toLocaleString('fr-FR')} francs` : 'Nouveau devis')
        setFeedback({ text: action.amount ? `Devis ${action.amount.toLocaleString('fr-FR')} FCFA →` : 'Nouveau devis →', ok: true })
        setOpen(false)
        router.push(url)
        break
      }
      case 'new_invoice': {
        const url = action.amount ? `/merchant/tools/facture?amount=${action.amount}` : '/merchant/tools/facture'
        speak(action.amount ? `Facture de ${action.amount.toLocaleString('fr-FR')} francs` : 'Nouvelle facture')
        setFeedback({ text: action.amount ? `Facture ${action.amount.toLocaleString('fr-FR')} FCFA →` : 'Nouvelle facture →', ok: true })
        setOpen(false)
        router.push(url)
        break
      }
      case 'back':
        setFeedback({ text: '← Retour', ok: true })
        speak('Retour')
        setOpen(false)
        router.back()
        break
      case 'amount':
        setFeedback({ text: `${action.value.toLocaleString('fr-FR')} FCFA`, ok: true })
        speak(`${action.value.toLocaleString('fr-FR')} francs`)
        break
      case 'help':
        setFeedback({ text: 'Commandes disponibles ↓', ok: true })
        speak('Voici les commandes disponibles.')
        setOpen(true)
        break
    }
  }

  // ─── Gestionnaire d'action LLM (fallback ~500ms) ──────────────────────────
  async function applyLlmAction(action: LlmAction) {
    setFeedback({ text: action.reply, ok: action.action !== 'unknown' })
    speak(action.reply)

    switch (action.action) {
      case 'navigate': {
        const href = (action.data as { href?: string }).href
        if (href) { setOpen(false); router.push(href) }
        break
      }
      case 'pay': {
        const amount = (action.data as { amount_fcfa?: number }).amount_fcfa
        if (amount) { setOpen(false); router.push(`/pay?amount=${amount}`) }
        break
      }
      case 'receive': {
        const amount = (action.data as { amount_fcfa?: number }).amount_fcfa
        setOpen(false)
        router.push(amount ? `/merchant/receive?amount=${amount}` : '/merchant/receive')
        break
      }
      case 'search': {
        const query = (action.data as { query?: string }).query
        if (query) { setOpen(false); router.push(`/marketplace?q=${encodeURIComponent(query)}`) }
        break
      }
      case 'budget_entry': {
        const d = action.data as { montant_fcfa?: number; type?: string; categorie?: string; description?: string }
        if (!d.montant_fcfa) break
        try {
          const res = await fetch('/api/budget-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...d, source: 'voice' }),
          })
          if (res.ok) toast.success(`${d.montant_fcfa.toLocaleString('fr-FR')} FCFA enregistré ✓`)
        } catch { /* silent */ }
        break
      }
      case 'create_product': {
        const d = action.data as { name?: string; prix?: number; categorie?: string }
        const params = new URLSearchParams({ action: 'new' })
        if (d.name) params.set('name', d.name)
        if (d.prix) params.set('prix', String(d.prix))
        if (d.categorie) params.set('cat', d.categorie)
        setOpen(false)
        router.push(`/merchant/products?${params.toString()}`)
        break
      }
      case 'query_balance': {
        try {
          const res = await fetch('/api/wallets')
          if (res.ok) {
            const w = await res.json()
            const bal = (w?.balance_fcfa ?? w?.[0]?.balance_fcfa ?? 0) as number
            const msg = `Tu as ${bal.toLocaleString('fr-FR')} francs dans ton portefeuille.`
            speak(msg)
            setFeedback({ text: `Solde : ${bal.toLocaleString('fr-FR')} FCFA`, ok: true })
          }
        } catch { /* silent */ }
        break
      }
      case 'query_score': {
        try {
          const res = await fetch('/api/scoring')
          if (res.ok) {
            const s = await res.json() as { score?: number; niveau?: string }
            const msg = `Ton score GreenFlame est ${s.score ?? 0} sur mille. Niveau ${s.niveau ?? 'débutant'}.`
            speak(msg)
            setFeedback({ text: `Score : ${s.score ?? 0}/1000 — ${s.niveau ?? 'débutant'}`, ok: true })
          }
        } catch { /* silent */ }
        break
      }
      case 'back':
        setOpen(false)
        router.back()
        break
      case 'help':
        setOpen(true)
        break
    }
  }

  // ─── Gestionnaire principal ───────────────────────────────────────────────
  const handleVoice = useCallback(async (transcript: string) => {
    setLastCommand(transcript)
    const ctx = getContext(pathname)

    // 1. Parser de mots-clés — instantané, gratuit, offline
    const fast = parseVoiceCommand(transcript, ctx)
    if (fast.type !== 'unknown') {
      applyParsedAction(fast)
      return
    }

    // 2. Fallback LLM — comprend le langage naturel complet
    setProcessing(true)
    try {
      const res = await fetch('/api/voice/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, context: { page: pathname, role: ctx } }),
      })
      if (!res.ok) throw new Error('api')
      const llmAction = await res.json() as LlmAction
      await applyLlmAction(llmAction)
    } catch {
      setFeedback({ text: 'Erreur réseau', ok: false })
    } finally {
      setProcessing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router])

  const { listening, supported, start, stop } = useVoice(handleVoice)

  // Raccourci clavier Espace
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (!listening) start()
    }
    function onKeyup(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      stop()
    }
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup',   onKeyup)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('keyup',   onKeyup)
    }
  }, [listening, start, stop])

  // Effacer le feedback après 4s
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  if (!supported) return null

  const btnActive = listening || processing

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-28 right-4 z-50 w-12 h-12 rounded-full fab flex items-center justify-center transition-all ${
          listening   ? 'bg-red-500'
          : processing ? 'bg-orange-400'
          : headerBg
        }`}
        aria-label="Assistant vocal"
      >
        {listening && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40 pointer-events-none" />
        )}
        {processing ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        )}
      </button>

      {/* Toast feedback */}
      {feedback && !open && (
        <div className={`fixed bottom-44 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg pointer-events-none max-w-[200px] text-right ${
          feedback.ok ? `${headerBg} text-white` : 'bg-red-500 text-white'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Panneau vocal */}
      {open && (
        <div className="fixed bottom-44 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-13rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">

          <div className={`px-4 py-3 ${headerBg} flex items-center justify-between flex-shrink-0`}>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">Assistant vocal</span>
              <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{ctxLabel}</span>
              {listening && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">EN ÉCOUTE</span>
              )}
              {processing && (
                <span className="text-[10px] font-bold bg-orange-400 text-white px-2 py-0.5 rounded-full">IA…</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">

            {/* Bouton micro */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={btnActive ? stop : start}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  listening   ? 'bg-red-500 shadow-xl shadow-red-200 scale-105'
                  : processing ? 'bg-orange-400 shadow-lg cursor-wait'
                  : `${headerBg} shadow-lg shadow-black/10`
                }`}
              >
                {listening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
                    <span className="absolute inset-3 rounded-full bg-red-400 animate-ping opacity-20" style={{ animationDelay: '0.15s' }} />
                  </>
                )}
                {processing ? (
                  <span className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                  </svg>
                )}
              </button>
              <p className="text-xs text-gray-400">
                {listening ? '🔴 Parlez maintenant…' : processing ? '⏳ Traitement en cours…' : 'Appuyer ou maintenir Espace'}
              </p>
            </div>

            {/* Retour commande */}
            {lastCommand && (
              <div className={`rounded-xl px-3 py-2 text-sm border ${
                feedback?.ok === false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
              }`}>
                <span className="text-gray-400 text-xs block mb-0.5">Entendu :</span>
                <span className="text-gray-700 font-medium">&ldquo;{lastCommand}&rdquo;</span>
                {feedback && (
                  <span className={`block text-xs mt-1 font-semibold ${feedback.ok ? 'text-brand-600' : 'text-red-500'}`}>
                    {feedback.text}
                  </span>
                )}
              </div>
            )}

            {/* Exemples et hints */}
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                Exemples — {ctxLabel}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {hints.map(hint => (
                  <button
                    key={hint.label}
                    onClick={() => handleVoice(hint.label)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full transition-colors"
                    title={hint.example}
                  >
                    {hint.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {examples.map(ex => (
                  <div
                    key={ex.label}
                    className="bg-gray-50 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleVoice(ex.label.replace(/[""]/g, ''))}
                  >
                    <p className="text-xs text-gray-700 font-mono">{ex.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{ex.example}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                Maintenir <kbd className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-mono">Espace</kbd> pour parler sans ouvrir ce panneau
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
