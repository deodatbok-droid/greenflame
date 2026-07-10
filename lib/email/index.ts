/**
 * GreenFlame — Service email via Resend
 *
 * Variables d'environnement requises :
 *   RESEND_API_KEY    — clé API Resend (resend.com)
 *   RESEND_FROM_EMAIL — adresse expéditeur vérifiée (défaut: noreply@greenflameafrica.com)
 *   RESEND_FROM_NAME  — nom affiché (défaut: GreenFlame)
 *   ADMIN_EMAIL       — email admin principal (alertes, KYC…)
 *   ADMIN_EMAIL_2     — email admin secondaire (optionnel)
 */

import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflameafrica.com'

function cleanEnv(val: string | undefined): string | undefined {
  return val?.replace(/^﻿/, '').trim() || undefined
}

const WRAP = (body: string) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">${body}</body>
</html>`

function getFrom(): string {
  const name  = cleanEnv(process.env.RESEND_FROM_NAME)  ?? 'GreenFlame'
  const email = cleanEnv(process.env.RESEND_FROM_EMAIL) ?? 'noreply@greenflameafrica.com'
  return `${name} <${email}>`
}

export function getAdminEmails(): string[] {
  const emails: string[] = []
  if (process.env.ADMIN_EMAIL)   emails.push(process.env.ADMIN_EMAIL)
  if (process.env.ADMIN_EMAIL_2) emails.push(process.env.ADMIN_EMAIL_2)
  return emails.length > 0 ? emails : ['aurelioteam229@gmail.com']
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  const apiKey = cleanEnv(process.env.RESEND_API_KEY)
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY non configurée — email ignoré:', subject)
    return
  }

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (recipients.length === 0) return

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from:    getFrom(),
      to:      recipients,
      subject,
      html:    html.trimStart().startsWith('<!DOCTYPE') ? html : WRAP(html),
    })
    if (error) console.error('[Email] Erreur Resend', error)
  } catch (err) {
    console.error('[Email] Erreur réseau Resend', err)
  }
}

// ── Bienvenue ──────────────────────────────────────────────────────
export async function sendWelcomeEmail(
  name: string,
  referralCode: string,
  phone: string,
  userEmail: string | null = null
) {
  const adminEmails = getAdminEmails()
  const recipients  = [...adminEmails]
  if (userEmail && !adminEmails.includes(userEmail)) recipients.push(userEmail)

  await sendEmail({
    to:      recipients,
    subject: `Bienvenue sur GreenFlame, ${name} ! 🔥`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
        <h1 style="color:#16a34a;margin-bottom:4px">🔥 GreenFlame</h1>
        <h2 style="color:#111;margin-top:0">Bienvenue, ${name} !</h2>
        <p style="color:#444">Votre compte GreenFlame est activé. Commencez à gagner des dividendes communautaires sur chaque achat.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px">Votre code d'invitation</p>
          <p style="margin:0;font-size:22px;font-weight:bold;color:#16a34a;font-family:monospace">${referralCode}</p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:12px">Partagez-le pour développer votre communauté</p>
        </div>
        <p style="color:#6b7280;font-size:13px">Téléphone enregistré : ${phone}</p>
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Accéder au tableau de bord →
        </a>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px;margin:0">GreenFlame · Cotonou, Bénin</p>
      </div>
    `,
  })
}

// ── KYC soumis (admins) ────────────────────────────────────────────
export async function sendKycNotificationEmail(userName: string, userId: string) {
  await sendEmail({
    to:      getAdminEmails(),
    subject: `[KYC] Nouvelle soumission : ${userName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#16a34a">🔥 Nouvelle soumission KYC</h2>
        <p><strong>${userName}</strong> vient de soumettre ses documents d'identité et attend votre vérification.</p>
        <a href="${APP_URL}/admin/kyc"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Vérifier maintenant →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px">ID : ${userId}</p>
      </div>
    `,
  })
}

// ── Résultat KYC ───────────────────────────────────────────────────
export async function sendKycResultEmail(
  userName: string,
  _phone: string,
  approved: boolean,
  reason?: string,
  userEmail?: string | null
) {
  const adminEmails = getAdminEmails()
  const recipients  = [...adminEmails]
  if (userEmail && !adminEmails.includes(userEmail)) recipients.push(userEmail)

  await sendEmail({
    to:      recipients,
    subject: approved
      ? `✅ Identité vérifiée — ${userName}`
      : `❌ Documents KYC refusés — ${userName}`,
    html: approved
      ? `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
          <h2 style="color:#16a34a">✅ Identité vérifiée</h2>
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Votre identité a été vérifiée avec succès sur GreenFlame. Vous avez maintenant accès à l'ensemble des fonctionnalités.</p>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
            Accéder au tableau de bord →
          </a>
        </div>
      `
      : `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
          <h2 style="color:#dc2626">❌ Documents non valides</h2>
          <p>Bonjour <strong>${userName}</strong>,</p>
          <p>Vos documents d'identité n'ont pas pu être validés.</p>
          ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:16px 0"><p style="margin:0;color:#dc2626">Raison : ${reason}</p></div>` : ''}
          <p>Veuillez soumettre à nouveau vos documents depuis l'application.</p>
          <a href="${APP_URL}/kyc" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
            Resoumettre mes documents →
          </a>
        </div>
      `,
  })
}

// ── Alerte abonnement marchand (admins) ────────────────────────────
export async function sendSubscriptionAlertEmail(params: {
  merchantName: string
  tier: string
  amount: number
  method: 'mtn_momo' | 'moov_money' | 'cash'
  phone?: string
  status: 'pending_cash' | 'paid'
}) {
  const { merchantName, tier, amount, method, phone, status } = params
  const tierLabel: Record<string, string> = {
    pro: 'Pro', vip: 'VIP', vip_upgrade: 'Upgrade VIP', agent: 'Service Agent',
    salon: 'Salon & Beauté', couture: 'Couture & Mode', btp: 'BTP & Artisans', resto: 'Restauration',
  }
  const methodLabel: Record<string, string> = {
    mtn_momo: 'MTN MoMo', moov_money: 'Moov Money', cash: 'Espèces',
  }
  const isPending = status === 'pending_cash'

  await sendEmail({
    to:      getAdminEmails(),
    subject: isPending
      ? `[GreenFlame] Demande abonnement espèces — ${merchantName}`
      : `[GreenFlame] Abonnement payé — ${merchantName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#16a34a">🔥 ${isPending ? "Demande d'abonnement" : 'Abonnement confirmé'}</h2>
        <p><strong>${merchantName}</strong> ${isPending ? 'souhaite souscrire au' : 'a payé le'} plan <strong>${tierLabel[tier] ?? tier}</strong>.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 0;color:#6b7280">Marchand</td><td style="padding:4px 0;font-weight:600">${merchantName}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Offre</td><td style="padding:4px 0;font-weight:600">${tierLabel[tier] ?? tier}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Montant</td><td style="padding:4px 0;font-weight:600">${amount.toLocaleString()} FCFA</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Paiement</td><td style="padding:4px 0;font-weight:600">${methodLabel[method] ?? method}</td></tr>
            ${phone ? `<tr><td style="padding:4px 0;color:#6b7280">Téléphone</td><td style="padding:4px 0;font-weight:600">${phone}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#6b7280">Statut</td><td style="padding:4px 0;font-weight:600">${isPending ? '⏳ En attente — espèces au Hub' : '✅ Paiement confirmé (Momo)'}</td></tr>
          </table>
        </div>
        ${isPending
          ? "<p style='color:#444;font-size:14px'>Le marchand viendra payer au Hub en espèces.</p>"
          : "<p style='color:#444;font-size:14px'>L'abonnement a été activé automatiquement.</p>"
        }
        <a href="${APP_URL}/admin/merchants"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Voir les marchands →
        </a>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px;margin:0">GreenFlame · Cotonou, Bénin</p>
      </div>
    `,
  })
}

// ── Paiement reçu (marchand) ───────────────────────────────────────
export async function sendPaymentReceivedEmail(
  merchantName: string,
  amount: number,
  buyerName: string,
  merchantEmail: string | null
) {
  if (!merchantEmail) return
  await sendEmail({
    to:      merchantEmail,
    subject: `💰 Paiement reçu : ${amount.toLocaleString()} FCFA`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#16a34a">💰 Nouveau paiement reçu</h2>
        <p>Bonjour <strong>${merchantName}</strong>,</p>
        <p>Vous avez reçu un paiement de <strong>${buyerName}</strong>.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
          <p style="margin:0;font-size:32px;font-weight:bold;color:#16a34a">${amount.toLocaleString()} FCFA</p>
        </div>
        <a href="${APP_URL}/merchant/history" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Voir mes transactions →
        </a>
      </div>
    `,
  })
}

// ── Alerte stock bas (marchand) ────────────────────────────────────
export async function sendStockAlertEmail(params: {
  productName: string
  productEmoji: string
  stockQuantity: number
  threshold: number
  merchantName: string
  merchantEmail: string
  fullName: string
}) {
  const { productName, productEmoji, stockQuantity, threshold, merchantName, merchantEmail, fullName } = params
  const isRupture = stockQuantity === 0
  const stockMsg = isRupture
    ? 'est en rupture de stock !'
    : `n'a plus que ${stockQuantity} unité${stockQuantity > 1 ? 's' : ''} en stock`

  await sendEmail({
    to:      merchantEmail,
    subject: `${isRupture ? '🔴 Rupture' : '⚠️ Stock faible'} : ${productEmoji} ${productName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#166534,#15803d);padding:28px 24px;text-align:center;">
      <p style="margin:0;color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">🌿 GreenFlame</p>
      <p style="margin:8px 0 0;color:#86efac;font-size:13px;">Alerte stock marchand</p>
    </div>
    <div style="padding:28px 24px;">
      <div style="background:${isRupture ? '#fef2f2' : '#fffbeb'};border:2px solid ${isRupture ? '#fca5a5' : '#fde68a'};border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:32px;">${productEmoji}</p>
        <p style="margin:0;font-weight:700;font-size:18px;color:#111827;">${productName}</p>
        <p style="margin:8px 0 0;color:${isRupture ? '#dc2626' : '#d97706'};font-weight:600;font-size:15px;">${stockMsg}</p>
        <div style="margin-top:12px;display:inline-block;background:${isRupture ? '#dc2626' : '#d97706'};color:white;font-size:28px;font-weight:800;padding:8px 20px;border-radius:10px;min-width:80px;">
          ${stockQuantity}
        </div>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">unité${stockQuantity !== 1 ? 's' : ''} restante${stockQuantity !== 1 ? 's' : ''}</p>
      </div>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Bonjour ${fullName},<br><br>
        Votre boutique <strong>${merchantName}</strong> a besoin de réapprovisionnement.
        ${isRupture
          ? "Ce produit est masqué automatiquement du catalogue jusqu'à réapprovisionnement."
          : `Il vous reste moins de ${threshold + 1} unités — pensez à réapprovisionner.`
        }
      </p>
      <a href="${APP_URL}/merchant/dashboard"
         style="display:block;text-align:center;background:#16a34a;color:white;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px;margin-bottom:16px;">
        Gérer mon catalogue →
      </a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
        GreenFlame · Commerce communautaire · Cotonou, Bénin
      </p>
    </div>
  </div>
</body>
</html>`,
  })
}
