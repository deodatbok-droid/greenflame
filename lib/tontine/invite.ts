/**
 * GreenFlame — Invitations de membres de tontine
 *
 * Un membre ajouté par l'admin (nom + téléphone) reste "pending" jusqu'à ce
 * qu'il valide son invitation via un lien à token unique, ce qui nécessite
 * un compte GreenFlame (l'opération lie son user_id à la ligne membre).
 * Le lien expire 7 jours après génération (création initiale ou relance).
 *
 * Notification : WhatsApp en premier, repli SMS (Africa's Talking) si
 * l'envoi WhatsApp échoue — pas de moyen de confirmer qu'un numéro est
 * effectivement sur WhatsApp, donc on utilise l'échec d'envoi (clé API
 * manquante, erreur réseau, ou réponse HTTP en erreur de Wasender) comme
 * signal de repli. Si le membre n'a aucun numéro, aucune notification.
 */
import { randomBytes } from 'crypto'
import { sendWhatsApp, waTontineInvite } from '@/lib/whatsapp/wasender'
import { sendSms, smsTontineInvite } from '@/lib/ussd/africastalking'

export const TONTINE_INVITE_EXPIRY_DAYS = 7

export function generateInviteToken(): string {
  return randomBytes(16).toString('hex')
}

export function inviteExpiryDate(): string {
  return new Date(Date.now() + TONTINE_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
  return `${baseUrl}/tontine/invite/${token}`
}

interface NotifyTontineInviteOpts {
  phone: string | null
  memberFirstName: string
  tontineName: string
  creatorName: string
  token: string
  resend?: boolean
}

/**
 * Envoie la notification d'invitation (WhatsApp puis repli SMS si échec).
 * Non-bloquant — ne lance jamais d'exception, à appeler en fire-and-forget
 * depuis les routes API (`void notifyTontineInvite(...)`).
 */
export async function notifyTontineInvite(opts: NotifyTontineInviteOpts): Promise<void> {
  if (!opts.phone) return

  const inviteUrl = buildInviteUrl(opts.token)

  try {
    const waOk = await sendWhatsApp(opts.phone, waTontineInvite({
      memberFirstName: opts.memberFirstName,
      tontineName: opts.tontineName,
      creatorName: opts.creatorName,
      inviteUrl,
      resend: opts.resend,
    }))

    if (!waOk) {
      await sendSms({
        to: opts.phone,
        message: smsTontineInvite({
          creatorName: opts.creatorName,
          tontineName: opts.tontineName,
          inviteUrl,
        }),
      })
    }
  } catch (err) {
    console.error('[notifyTontineInvite] Erreur non-bloquante', err)
  }
}
