'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useVoice, speak } from '@/lib/hooks/useVoice'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import { parseMerchantCommand, parseFrenchNumber, MERCHANT_VOICE_HINTS } from '@/lib/utils/voiceParser'
import { useLocale } from '@/components/providers/LocaleProvider'

type Line = { description: string; qty: number; unitPrice: number }
type Mode = 'navigation' | 'produits' | 'montant'

// Mots de quantité reconnus (unités standard)
const UNIT_WORDS = 'unités?|pièces?|pces?|kg|kilogrammes?|grammes?|g\\b|litres?|l\\b|cl\\b|boîtes?|sacs?|sachets?|exemplaires?|cartons?|bouteilles?|rouleaux?|tablettes?|comprimés?|doses?|portions?'

// Parse vocal de produit — ordre flexible :
//   "Riz 5000 francs 25 kg"
//   "Savon Lux trois pièces mille francs"
//   "cinq kg Huile de palme deux mille FCFA"
function parseProductFromSpeech(text: string): Partial<Line & { name: string }> | null {
  let t = text.toLowerCase()

  // ── 1. PRIX ───────────────────────────────────────────────────────────────
  // a) Chiffres + "francs/FCFA/etc."
  const priceDigitMatch = t.match(/(\d[\d\s]*)\s*(?:francs?|fcfa|cfa\b|f\b)/i)
  let price = 0
  let priceToken = ''

  if (priceDigitMatch) {
    price = parseInt(priceDigitMatch[1].replace(/\s/g, ''))
    priceToken = priceDigitMatch[0]
  } else {
    // b) Mots + "francs/FCFA"  ex: "cinq mille francs"
    const wordPriceMatch = t.match(/([\w\s-]+?)\s*(?:francs?|fcfa|cfa\b)/i)
    if (wordPriceMatch) {
      const candidate = wordPriceMatch[1].trim()
      const parsed = parseFrenchNumber(candidate)
      if (parsed && parsed >= 50) {
        price = parsed
        priceToken = wordPriceMatch[0]
      }
    }
    // c) Mots seuls sans suffixe (ex: "cinq mille") — dernier recours
    if (!price) {
      const fallback = parseFrenchNumber(
        t.replace(new RegExp(`\\b(${UNIT_WORDS})\\b`, 'i'), '').trim()
      )
      if (fallback && fallback >= 50) price = fallback
    }
  }

  // ── 2. QUANTITÉ ───────────────────────────────────────────────────────────
  // a) Chiffres + unité  ex: "25 kg"
  const qtyDigitRe = new RegExp(`(\\d+)\\s*(?:${UNIT_WORDS})`, 'i')
  const qtyDigitMatch = t.match(qtyDigitRe)
  let qty = 1
  let qtyToken = ''

  if (qtyDigitMatch) {
    qty = parseInt(qtyDigitMatch[1])
    qtyToken = qtyDigitMatch[0]
  } else {
    // b) Mots + unité  ex: "cinq kg", "trois unités", "deux boîtes"
    const qtyWordRe = new RegExp(`(\\w[\\w\\s-]*?)\\s+(?:${UNIT_WORDS})`, 'i')
    const qtyWordMatch = t.match(qtyWordRe)
    if (qtyWordMatch) {
      const candidate = qtyWordMatch[1].trim()
      const parsed = parseFrenchNumber(candidate)
      if (parsed && parsed >= 1 && parsed <= 9999) {
        qty = parsed
        qtyToken = qtyWordMatch[0]
      }
    }
  }

  // ── 3. NOM ────────────────────────────────────────────────────────────────
  // Retirer du texte original : token prix, token qté, mots parasites
  let name = text
  if (priceToken) name = name.replace(new RegExp(priceToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  if (qtyToken)   name = name.replace(new RegExp(qtyToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  name = name
    .replace(/\b(francs?|fcfa|cfa)\b/gi, ' ')
    .replace(new RegExp(`\\b(${UNIT_WORDS})\\b`, 'gi'), ' ')
    .replace(/\b(ajouter|article|produit|à|de|pour|le|la|les|l'|un|une|des|du|au)\b/gi, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\d+/g, ' ')          // chiffres résiduels
    .replace(/\s+/g, ' ')
    .trim()

  // Première lettre en majuscule
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1)
  if (!name) return null

  return { description: name, qty, unitPrice: price }
}

export default function VoiceMerchantPage() {
  const router = useRouter()
  const { t } = useLocale()
  const [transcript, setTranscript]   = useState('')
  const [lines,      setLines]        = useState<Line[]>([])
  const [mode,       setMode]         = useState<Mode>('navigation')
  const [lastStatus, setLastStatus]   = useState<{ text: string; ok: boolean } | null>(null)

  const switchMode = useCallback((m: Mode) => {
    setMode(m)
    // speak() calls remain in French — voice commands target French-speaking merchants
    const labels: Record<Mode, string> = {
      navigation: 'Mode navigation activé.',
      produits:   'Mode ajout de produits. Dites le nom, la quantité et le prix.',
      montant:    'Mode montant. Dites un montant en francs.',
    }
    speak(labels[m])
    setLastStatus({ text: labels[m], ok: true })
  }, [])

  const handleVoice = useCallback((text: string) => {
    setTranscript(text)
    const lower = text.toLowerCase()

    // Commande globale de changement de mode
    if (/\b(ajouter|produit|article|catalogue)\b/.test(lower)) {
      switchMode('produits')
      return
    }
    if (/\b(terminer|fin|arrêter|quitter|sortir)\b/.test(lower)) {
      if (mode === 'produits') {
        speak(`${lines.length} produit${lines.length > 1 ? 's' : ''} enregistré${lines.length > 1 ? 's' : ''}. Retour en navigation.`)
        setLastStatus({ text: `${lines.length} produits enregistrés`, ok: true })
      } else {
        speak('Mode navigation.')
      }
      setMode('navigation')
      return
    }
    if (/\b(supprimer|effacer|annuler)\s+(dernier|tout)\b/.test(lower)) {
      if (lower.includes('tout')) {
        setLines([])
        speak('Liste effacée.')
        setLastStatus({ text: 'Liste effacée', ok: true })
      } else {
        setLines(prev => {
          const next = prev.slice(0, -1)
          speak(`Dernier article supprimé. ${next.length} article${next.length > 1 ? 's' : ''} restant${next.length > 1 ? 's' : ''}.`)
          return next
        })
        setLastStatus({ text: 'Dernier article supprimé', ok: true })
      }
      return
    }

    if (mode === 'navigation') {
      const action = parseMerchantCommand(text)

      if (action.type === 'navigate') {
        speak(`Navigation vers ${action.label}`)
        setLastStatus({ text: `→ ${action.label}`, ok: true })
        router.push(action.path)
        return
      }
      if (action.type === 'help') {
        speak('Commandes : dashboard, encaisser, produits, devis, facture, analytics. Dites "ajouter un produit" pour dicter votre catalogue.')
        setLastStatus({ text: 'Aide affichée', ok: true })
        return
      }
      if (action.type === 'amount') {
        speak(`${action.value.toLocaleString('fr-FR')} francs. Pour enregistrer, dites "ajouter un produit".`)
        setLastStatus({ text: `Montant détecté : ${formatFcfa(action.value)} FCFA`, ok: true })
        return
      }
      speak(`Commande non reconnue. Dites aide pour voir les commandes disponibles.`)
      setLastStatus({ text: `Non reconnu : "${text}"`, ok: false })

    } else if (mode === 'produits') {
      const parsed = parseProductFromSpeech(text)
      if (parsed?.description) {
        const line: Line = {
          description: parsed.description,
          qty:         parsed.qty ?? 1,
          unitPrice:   parsed.unitPrice ?? 0,
        }
        setLines(prev => [...prev, line])
        speak(`Ajouté : ${line.description}. ${line.qty > 1 ? `${line.qty} unités.` : ''} ${line.unitPrice > 0 ? `${line.unitPrice.toLocaleString('fr-FR')} francs.` : 'Prix à compléter.'}`)
        toast.success(`✓ ${line.description}`)
        setLastStatus({ text: `✓ ${line.description} — ${line.qty} × ${formatFcfa(line.unitPrice)}`, ok: true })
      } else {
        speak('Format non reconnu. Exemple : Riz 25 kg, 15 000 francs.')
        setLastStatus({ text: 'Format non reconnu', ok: false })
      }
    }
  }, [mode, lines.length, router, switchMode])

  const { listening, supported, start, stop } = useVoice(handleVoice)
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)

  if (!supported) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center py-16">
        <p className="text-4xl mb-4">🎤</p>
        <p className="font-semibold text-gray-700">{t('merchant.voicePage.unsupported')}</p>
        <p className="text-sm text-gray-400 mt-2">{t('merchant.voicePage.unsupportedDesc')}</p>
        <Link href="/merchant/tools" className="mt-4 inline-block text-brand-600 text-sm">{t('merchant.voicePage.backToTools')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('merchant.voicePage.title')} 🎤</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('merchant.voicePage.subtitle')}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.voicePage.backToTools')}</Link>
      </div>

      {/* Sélecteur de mode */}
      <div className="flex gap-2">
        {(['navigation', 'produits'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === m
                ? m === 'produits' ? 'bg-green-600 text-white border-green-600' : 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {m === 'navigation' ? t('merchant.voicePage.modeNav') : t('merchant.voicePage.modeProd')}
          </button>
        ))}
      </div>

      {/* Indicateur de mode */}
      <div className={`rounded-2xl p-4 border ${
        mode === 'produits'
          ? 'bg-green-50 border-green-200'
          : 'bg-brand-50 border-brand-200'
      }`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">{t('merchant.voicePage.modeActive')}</p>
        <p className={`font-bold text-base ${mode === 'produits' ? 'text-green-700' : 'text-brand-700'}`}>
          {mode === 'navigation' ? t('merchant.voicePage.modeNavLong') : t('merchant.voicePage.modeProdLong')}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {mode === 'navigation' ? t('merchant.voicePage.navHint') : t('merchant.voicePage.prodHint')}
        </p>
      </div>

      {/* Grand bouton micro */}
      <div className="flex justify-center">
        <button
          onClick={listening ? stop : start}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all ${
            listening
              ? 'bg-red-500 shadow-2xl shadow-red-300 scale-105'
              : 'bg-brand-600 shadow-xl shadow-brand-200 hover:bg-brand-700'
          }`}
        >
          {listening && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
              <span className="absolute inset-4 rounded-full bg-red-400 animate-ping opacity-20" style={{ animationDelay: '0.2s' }} />
            </>
          )}
          <svg viewBox="0 0 24 24" fill="white" className="w-14 h-14">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </button>
      </div>
      <p className="text-center text-sm text-gray-400">
        {listening ? t('merchant.voicePage.listening') : t('merchant.voicePage.tapToSpeak')}
      </p>

      {/* Dernier transcript + status */}
      {(transcript || lastStatus) && (
        <div className={`card border ${lastStatus?.ok === false ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
          {transcript && (
            <p className="text-sm text-gray-700">
              <span className="text-gray-400 text-xs">{t('merchant.voicePage.heard')} </span>
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          {lastStatus && (
            <p className={`text-xs font-semibold mt-1 ${lastStatus.ok ? 'text-brand-600' : 'text-red-500'}`}>
              {lastStatus.text}
            </p>
          )}
        </div>
      )}

      {/* Liste de produits dictés */}
      {lines.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">{lines.length} article{lines.length > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <p className="text-brand-600 font-bold text-sm">{formatFcfa(total)} FCFA</p>
              <button
                onClick={() => { setLines([]); speak('Liste effacée.') }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                {t('merchant.voicePage.clearAll')}
              </button>
            </div>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0">
              <span className="flex-1 text-gray-700 truncate">{l.description}</span>
              <span className="text-gray-400 text-xs flex-shrink-0">×{l.qty}</span>
              <span className="font-medium text-gray-900 w-24 text-right flex-shrink-0">
                {l.unitPrice > 0 ? formatFcfa(l.unitPrice) : <span className="text-amber-500">{t('merchant.voicePage.priceNeeded')}</span>}
              </span>
              <button
                onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Aide contextuelle */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
          {mode === 'navigation' ? t('merchant.voicePage.destinations') : t('merchant.voicePage.dictationCmds')}
        </p>
        {mode === 'navigation' ? (
          <div className="flex flex-wrap gap-1.5">
            {MERCHANT_VOICE_HINTS.map(h => (
              <button
                key={h.label}
                onClick={() => handleVoice(h.label)}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 px-2.5 py-1 rounded-full transition-colors"
                title={h.example}
              >
                {h.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-xs text-gray-500">
            <p>🗣 <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">&ldquo;Riz 25 kg, 15 000 francs&rdquo;</span></p>
            <p>🗣 <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">&ldquo;Eau minérale 500 francs 10 unités&rdquo;</span></p>
            <p>🗣 <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">&ldquo;Supprimer le dernier&rdquo;</span> · <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">&ldquo;Terminer&rdquo;</span></p>
          </div>
        )}
      </div>
    </div>
  )
}
