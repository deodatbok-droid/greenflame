const FCFA_TO_GFP = 10 // 1 FCFA = 10 GFP

/**
 * Décompose un montant cashback exact (flottant FCFA) en :
 *  - fcfa  : partie entière en FCFA
 *  - gfp   : fraction résiduelle convertie en GFP (1 FCFA = 10 GFP)
 *  - label : chaîne prête à afficher, ex. "+7 FCFA + 5 GFP" ou "+75 GFP"
 */
export function formatCashback(exactFcfa: number): { fcfa: number; gfp: number; label: string } {
  const fcfa = Math.floor(exactFcfa)
  const gfp  = Math.round((exactFcfa - fcfa) * FCFA_TO_GFP)
  let label = ''
  if (fcfa > 0 && gfp > 0) label = `+${formatFcfa(fcfa)} FCFA + ${gfp} GFP`
  else if (fcfa > 0)        label = `+${formatFcfa(fcfa)} FCFA`
  else if (gfp > 0)         label = `+${gfp} GFP`
  return { fcfa, gfp, label }
}

/** Code de commission GreenFlame. Remplace l'affichage du taux brut.
 *  Ex : commissionCode(0.10) → "C-10"   commissionCode(0.05) → "C-5" */
export function commissionCode(rate: number): string {
  const pct = rate * 100
  return 'C-' + pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** Formate un taux (décimal) en %, sans arrondi, format français.
 *  Ex : formatPercent(0.10) → "10%"   formatPercent(0.0822) → "8,22%" */
export function formatPercent(rate: number): string {
  const pct = rate * 100
  return pct.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + '%'
}

/** Formate un montant exact FCFA en texte lisible (sans "+" préfixe).
 *  Ex : formatExactAmount(7.5) → "7 FCFA + 5 GFP"
 *       formatExactAmount(50)  → "50 FCFA"
 *       formatExactAmount(0.5) → "5 GFP" */
export function formatExactAmount(exactFcfa: number): string {
  if (exactFcfa <= 0) return '0 FCFA'
  const fcfa = Math.floor(exactFcfa)
  const gfp  = Math.round((exactFcfa - fcfa) * FCFA_TO_GFP)
  if (fcfa > 0 && gfp > 0) return `${formatFcfa(fcfa)} FCFA + ${gfp} GFP`
  if (fcfa > 0)             return `${formatFcfa(fcfa)} FCFA`
  return `${gfp} GFP`
}

/** Formate un taux de cashback en %, sans arrondi, format français.
 *  Ex : cashbackRate(0.10, 0.15) → "1,5%" */
export function cashbackRate(commissionRate: number, cashbackShare: number): string {
  const pct = commissionRate * cashbackShare * 100
  return pct.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + '%'
}

// Formate un montant en FCFA (entier, pas de decimales)
export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount)
}

// Formate une date relative (ex: "il y a 2 heures")
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'il y a quelques secondes'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days}j`
  return d.toLocaleDateString('fr-FR')
}

// Normalise un numero de telephone beninois
export function normalizeBeninPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('229')) return '+' + digits
  // Nouveau format 01XXXXXXXX (10 chiffres) — conserver le 01
  if (digits.startsWith('01') && digits.length === 10) return '+229' + digits
  // Ancien format avec 0 optionnel devant (9 chiffres) — supprimer le 0
  if (digits.startsWith('0') && digits.length === 9) return '+229' + digits.slice(1)
  if (digits.length === 8) return '+229' + digits
  return '+' + digits
}

// Genere un code idempotency
export function generateIdempotencyKey(prefix = 'tx'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
