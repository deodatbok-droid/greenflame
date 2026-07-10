/**
 * GreenFlame — Client Africa's Talking
 * Gère les réponses USSD et l'envoi de SMS de confirmation.
 *
 * Variables d'environnement requises :
 *   AT_API_KEY      — clé API Africa's Talking (sandbox ou prod)
 *   AT_USERNAME     — nom d'utilisateur AT (sandbox = "sandbox")
 *   AT_SENDER_ID    — ID expéditeur SMS (ex: "GreenFlame")
 *
 * Sandbox : AT_USERNAME=sandbox, AT_API_KEY=<clé sandbox AT>
 * Production : AT_USERNAME=greenflame, AT_API_KEY=<clé prod AT>
 */

// ----------------------------------------------------------------
// Types USSD
// ----------------------------------------------------------------

/** CON = continue la session | END = ferme la session */
export type UssdResponseType = 'CON' | 'END'

export function ussdCon(text: string): Response {
  return new Response(`CON ${text}`, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

export function ussdEnd(text: string): Response {
  return new Response(`END ${text}`, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

// ----------------------------------------------------------------
// SMS
// ----------------------------------------------------------------

const AT_BASE_URL = process.env.AT_USERNAME === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1/messaging'
  : 'https://api.africastalking.com/version1/messaging'

export interface SmsPayload {
  to: string | string[]   // numéros au format international +22997XXXXXX
  message: string
  from?: string           // sender ID (si approuvé par l'opérateur)
}

/**
 * Envoie un ou plusieurs SMS via Africa's Talking.
 * Non-bloquant sur erreur — log uniquement, ne fait pas échouer la transaction.
 */
export async function sendSms(payload: SmsPayload): Promise<void> {
  const apiKey = process.env.AT_API_KEY
  const username = process.env.AT_USERNAME

  if (!apiKey || !username) {
    console.warn('[AT SMS] Variables AT_API_KEY ou AT_USERNAME manquantes — SMS ignoré')
    return
  }

  const recipients = Array.isArray(payload.to) ? payload.to.join(',') : payload.to

  const body = new URLSearchParams({
    username,
    to: recipients,
    message: payload.message,
  })
  if (payload.from ?? process.env.AT_SENDER_ID) {
    body.set('from', payload.from ?? process.env.AT_SENDER_ID!)
  }

  try {
    const res = await fetch(AT_BASE_URL, {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[AT SMS] Erreur HTTP', res.status, txt)
    }
  } catch (err) {
    console.error('[AT SMS] Erreur réseau', err)
  }
}

// ----------------------------------------------------------------
// Templates SMS GreenFlame
// ----------------------------------------------------------------

export function smsPaiementAcheteur(opts: {
  merchantName: string
  amount: number
  cashback: number
  ref: string
  solde: number
}): string {
  return (
    `GreenFlame: Paiement de ${opts.amount.toLocaleString()} FCFA` +
    ` a ${opts.merchantName} confirme.` +
    ` Cashback: +${opts.cashback} FCFA.` +
    ` Ref: ${opts.ref}.` +
    ` Solde: ${opts.solde.toLocaleString()} FCFA.`
  )
}

export function smsPaiementMarchand(opts: {
  amount: number
  net: number
  buyerPhone: string
  ref: string
}): string {
  const maskedPhone = opts.buyerPhone.slice(0, -4) + 'XXXX'
  return (
    `GreenFlame: Paiement recu de ${maskedPhone}.` +
    ` Montant: ${opts.amount.toLocaleString()} FCFA.` +
    ` Net: ${opts.net.toLocaleString()} FCFA.` +
    ` Ref: ${opts.ref}.`
  )
}

export function smsPinDefini(): string {
  return 'GreenFlame: Votre code PIN de transaction a ete defini avec succes. Ne le communiquez a personne.'
}

export function smsPinBloque(): string {
  return 'GreenFlame: Votre PIN a ete bloque apres 3 tentatives incorrectes. Rendez-vous sur greenflame.bj pour le reinitialiser.'
}

export function smsTontineInvite(opts: {
  creatorName: string
  tontineName: string
  inviteUrl: string
}): string {
  return (
    `GreenFlame: ${opts.creatorName} vous a ajoute a la tontine "${opts.tontineName}".` +
    ` Validez votre invitation (valable 7 jours): ${opts.inviteUrl}`
  )
}
