/**
 * GreenFlame — Client Wasender (WhatsApp)
 * Envoie des messages WhatsApp via https://wasenderapi.com
 *
 * Variable d'environnement requise :
 *   WASENDER_API_KEY — clé API personnelle du compte Wasender
 *
 * Format téléphone attendu par Wasender : numéros sans "+" (ex: 22961234567)
 */

function normalizePhone(phone: string): string {
  let digits = phone.replace(/^\+/, '').replace(/\s/g, '')
  // Bénin nouveau format 22901XXXXXXXX → WhatsApp reconnaît encore 229XXXXXXXX
  if (digits.startsWith('22901') && digits.length === 13) {
    digits = '229' + digits.slice(5)
  }
  return digits
}

/**
 * Envoie un message WhatsApp via Wasender.
 * Non-bloquant sur erreur — log uniquement.
 *
 * Retourne `true` si l'envoi a été accepté par Wasender, `false` sinon
 * (clé manquante, erreur réseau, ou réponse HTTP en erreur — notamment
 * quand le numéro ne correspond à aucun compte WhatsApp). Les ~20 appels
 * existants ignorent cette valeur de retour (fire-and-forget) ; les
 * nouveaux appels qui ont besoin d'un repli (ex. SMS) peuvent l'utiliser.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const apiKey = process.env.WASENDER_API_KEY?.replace(/^﻿/, '').trim()
  if (!apiKey) {
    console.warn('[Wasender] WASENDER_API_KEY manquante — WhatsApp ignoré')
    return false
  }

  const to = normalizePhone(phone)
  console.log('[Wasender] Envoi →', to, '| original:', phone)

  try {
    const res = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, text: message }),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error('[Wasender] Erreur HTTP', res.status, body)
      return false
    }
    console.log('[Wasender] Réponse OK', res.status, body)
    return true
  } catch (err) {
    console.error('[Wasender] Erreur réseau', err)
    return false
  }
}

// ----------------------------------------------------------------
// Templates WhatsApp GreenFlame
// ----------------------------------------------------------------

export function waOtp(code: string): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `Votre code de connexion : *${code}*\n\n` +
    `⏱ Valide 5 minutes. Ne le partagez à personne.`
  )
}

export function waPaymentBuyer(opts: {
  merchantName: string
  amount: number
  cashback: number
  ref: string
  solde: number
}): string {
  return (
    `🔥 *GreenFlame — Paiement confirmé*\n\n` +
    `✅ *${opts.amount.toLocaleString()} FCFA* payés à *${opts.merchantName}*\n` +
    `💚 Cashback crédité : *+${opts.cashback} FCFA*\n` +
    `💰 Solde wallet : *${opts.solde.toLocaleString()} FCFA*\n` +
    `🔖 Réf : \`${opts.ref}\`\n\n` +
    `🌍 _Votre achat vient de propulser 5 personnes dans votre communauté. Ubuntu en action._`
  )
}

export function waPaymentMerchant(opts: {
  amount: number
  net: number
  buyerPhone: string
  ref: string
}): string {
  const maskedPhone = opts.buyerPhone.slice(0, -4) + 'XXXX'
  return (
    `🔥 *GreenFlame — Paiement reçu*\n\n` +
    `💵 Montant : *${opts.amount.toLocaleString()} FCFA*\n` +
    `💚 Net crédité : *${opts.net.toLocaleString()} FCFA*\n` +
    `👤 Acheteur : ${maskedPhone}\n` +
    `🔖 Réf : \`${opts.ref}\``
  )
}

export function waPinDefini(): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `✅ Votre code PIN de transaction a été défini avec succès.\n\n` +
    `🔒 Ne le communiquez à personne.`
  )
}

export function waPinBloque(): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `⚠️ Votre PIN a été bloqué après 3 tentatives incorrectes.\n\n` +
    `Rendez-vous sur greenflame.africa pour le réinitialiser.`
  )
}

export function waSubscription(opts: {
  tier: string
  merchantName: string
}): string {
  const tierLabels: Record<string, string> = {
    pro: '🚀 Pro',
    vip: '👑 VIP',
    agent: '🏦 Agent',
    salon: '✂️ Salon & Beauté',
    couture: '🪡 Couture & Mode',
    btp: '🏗️ BTP & Artisans',
    resto: '🍲 Restauration',
  }
  const label = tierLabels[opts.tier] ?? opts.tier
  return (
    `🔥 *GreenFlame — Abonnement activé*\n\n` +
    `🎉 Félicitations *${opts.merchantName}* !\n\n` +
    `Votre abonnement *${label}* est maintenant actif.\n\n` +
    `Accédez à votre espace sur greenflame.africa 🚀`
  )
}

export function waDigitalProduct(opts: {
  productName: string
  url: string
}): string {
  return (
    `🔥 *GreenFlame — Ta formation est prête !*\n\n` +
    `🎓 *${opts.productName}*\n\n` +
    `Clique ici pour accéder à ta formation :\n` +
    `👉 ${opts.url}\n\n` +
    `Bonne lecture et bonne pratique ! 🚀`
  )
}

export function waWelcomeUser(opts: {
  firstName: string
  referralCode: string
}): string {
  return (
    `🔥 *Bienvenue sur GreenFlame !*\n\n` +
    `Bonjour ${opts.firstName} 👋\n\n` +
    `Votre compte est actif !\n\n` +
    `🔗 Code d'invitation : *${opts.referralCode}*\n` +
    `🛒 Achetez et gagnez du cashback à chaque achat\n` +
    `💰 Invitez vos proches — commissions sur 5 niveaux\n` +
    `📊 Suivez votre santé financière dans l'Académie\n\n` +
    `👉 greenflame.africa/dashboard`
  )
}

export function waNewFilleul(opts: {
  filleulFirstName: string
  uplineCode: string
}): string {
  return (
    `🔥 *GreenFlame — Nouveau membre !*\n\n` +
    `🎉 *${opts.filleulFirstName}* vient de rejoindre GreenFlame avec votre code !\n\n` +
    `Dès son premier achat, votre commission arrivera directement dans votre portefeuille.\n\n` +
    `Continuez à partager votre code *${opts.uplineCode}* 🚀`
  )
}

export function waCommissionNetwork(opts: {
  amountFcfa: number
  level: number
  newBalance: number
  ref: string
}): string {
  return (
    `🔥 *GreenFlame — Commission réseau*\n\n` +
    `💰 *+${opts.amountFcfa.toLocaleString('fr-FR')} FCFA* crédités !\n` +
    `📊 Source : achat dans votre communauté — niveau ${opts.level}\n` +
    `💳 Solde wallet : *${opts.newBalance.toLocaleString('fr-FR')} FCFA*\n` +
    `🔖 Réf : \`${opts.ref}\`\n\n` +
    `👉 greenflame.africa/wallet`
  )
}

export function waCashPendingBuyer(opts: {
  merchantName: string
  amount: number
  ref: string
}): string {
  return (
    `🔥 *GreenFlame — Paiement espèces en attente*\n\n` +
    `💵 Votre paiement de *${opts.amount.toLocaleString('fr-FR')} FCFA* chez *${opts.merchantName}* est enregistré.\n` +
    `🔖 Réf : \`${opts.ref}\`\n\n` +
    `✅ Remettez les espèces au marchand pour déclencher votre cashback 🔥\n\n` +
    `👉 greenflame.africa/history`
  )
}

export function waCashPending(opts: {
  amount: number
  buyerPhone: string
  ref: string
}): string {
  const masked = opts.buyerPhone.length > 4 ? opts.buyerPhone.slice(0, -4) + 'XXXX' : opts.buyerPhone
  return (
    `🔥 *GreenFlame — Paiement cash en attente*\n\n` +
    `💵 Un client souhaite vous payer *${opts.amount.toLocaleString('fr-FR')} FCFA en cash*\n` +
    `👤 Client : ${masked}\n` +
    `🔖 Réf : \`${opts.ref}\`\n\n` +
    `✅ *Confirmez la réception pour déclencher cashback + commissions réseau :*\n` +
    `👉 greenflame.africa/merchant/dashboard`
  )
}

export function waAgentDepositClient(opts: {
  amount: number
  agentName: string
  newBalance: number
}): string {
  return (
    `🔥 *GreenFlame — Recharge wallet*\n\n` +
    `✅ *${opts.amount.toLocaleString('fr-FR')} FCFA* crédités sur votre portefeuille !\n` +
    `🏪 Via : *${opts.agentName}*\n` +
    `💳 Nouveau solde : *${opts.newBalance.toLocaleString('fr-FR')} FCFA*\n\n` +
    `👉 greenflame.africa/wallet`
  )
}

export function waFlammeInactivityWarning(opts: {
  firstName: string
  rangLabel: string
  rangEmoji: string
  daysLeft: number
}): string {
  return (
    `🔥 *GreenFlame — Ton rang ${opts.rangEmoji} ${opts.rangLabel}*\n\n` +
    `${opts.firstName}, ça fait un moment qu'on ne t'a pas vu actif sur GreenFlame.\n\n` +
    `⏳ Sans nouvelle activité (achat, formation, connexion...), ton rang *${opts.rangLabel}* redescendra automatiquement dans *${opts.daysLeft} jour${opts.daysLeft > 1 ? 's' : ''}*.\n\n` +
    `Une simple connexion suffit à repartir le compteur 👉 greenflame.africa/dashboard`
  )
}

// ----------------------------------------------------------------
// Nudges proactifs IA — un template par trigger psychologique dominant
// (voir public.ai_trigger, migration 029). Chaque message décrit un fait
// déjà réel (réseau déjà construit, rang déjà atteint, solde déjà acquis,
// activité déjà constatée dans le cercle) — aucun ne promet un gain futur.
// Throttle géré par la route appelante (user_ai_profile.message_fatigue_score
// et last_message_sent), pas ici.
// ----------------------------------------------------------------

export function waNudgeBelonging(opts: {
  firstName: string
  networkSize: number
  directRecruits: number
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, ton cercle compte déjà *${opts.networkSize} niveau${opts.networkSize > 1 ? 'x' : ''}* de membres connectés à toi, dont *${opts.directRecruits} filleul${opts.directRecruits > 1 ? 's' : ''} direct${opts.directRecruits > 1 ? 's' : ''}*.\n\n` +
    `👉 Va voir qui en fait partie : greenflame.africa/network`
  )
}

export function waNudgeStatus(opts: {
  firstName: string
  rangLabel: string
  rangEmoji: string
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, tu es actuellement *${opts.rangEmoji} ${opts.rangLabel}*.\n\n` +
    `Ce rang, c'est ce que ta communauté voit de toi. 👉 greenflame.africa/dashboard`
  )
}

export function waNudgeSecurity(opts: {
  firstName: string
  balanceFcfa: number
  totalEarnedFcfa: number
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, ton portefeuille GreenFlame contient *${opts.balanceFcfa.toLocaleString('fr-FR')} FCFA*.\n` +
    `💚 Déjà *${opts.totalEarnedFcfa.toLocaleString('fr-FR')} FCFA* gagnés en cashback et commissions depuis le début.\n\n` +
    `👉 greenflame.africa/wallet`
  )
}

export function waNudgeFomo(opts: {
  firstName: string
  directRecruits: number
  networkSize: number
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, ton cercle bouge : *${opts.directRecruits}* personne${opts.directRecruits > 1 ? 's' : ''} que tu as toi-même invitée${opts.directRecruits > 1 ? 's' : ''} ${opts.directRecruits > 1 ? 'sont' : 'est'} déjà actives sur GreenFlame.\n\n` +
    `👉 Vois ce qui se passe en ce moment : greenflame.africa/network`
  )
}

export function waNudgeIdentity(opts: {
  firstName: string
  directRecruits: number
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, en invitant ${opts.directRecruits > 0 ? `*${opts.directRecruits}* personne${opts.directRecruits > 1 ? 's' : ''}` : 'tes proches'} sur GreenFlame, tu fais grandir une économie communautaire réelle — l'Ubuntu en action, pas juste un mot.\n\n` +
    `👉 greenflame.africa/network`
  )
}

export function waNudgeCertainty(opts: {
  firstName: string
  rangLabel: string
  balanceFcfa: number
}): string {
  return (
    `🔥 *GreenFlame — Ton point clair*\n\n` +
    `${opts.firstName}, en un coup d'œil :\n` +
    `🏅 Rang : *${opts.rangLabel}*\n` +
    `💳 Solde wallet : *${opts.balanceFcfa.toLocaleString('fr-FR')} FCFA*\n\n` +
    `👉 Tout le détail sur greenflame.africa/dashboard`
  )
}

export function waNudgeAutonomy(opts: {
  firstName: string
  balanceFcfa: number
}): string {
  return (
    `🔥 *GreenFlame*\n\n` +
    `${opts.firstName}, ton solde de *${opts.balanceFcfa.toLocaleString('fr-FR')} FCFA* est dans ton wallet, sous ton contrôle — retire-le ou utilise-le quand tu veux.\n\n` +
    `👉 greenflame.africa/wallet`
  )
}

export function waParrainageReminder(opts: {
  firstName: string
  referralCode: string
}): string {
  return (
    `🔥 *GreenFlame — Partagez votre communauté !*\n\n` +
    `Bonjour ${opts.firstName} 👋\n\n` +
    `Vous êtes sur GreenFlame depuis 3 jours — mais votre communauté est encore vide.\n\n` +
    `💡 Chaque personne que vous invitez vous rapporte une commission automatique sur ses achats.\n\n` +
    `🔗 Votre code d'invitation : *${opts.referralCode}*\n\n` +
    `Partagez-le dès maintenant 👉 greenflame.africa/network`
  )
}

// ----------------------------------------------------------------
// Numéro admin GreenFlame — reçoit toutes les alertes événementielles
// ----------------------------------------------------------------
export const ADMIN_PHONE = '22997025083'

export function waAdminInscription(opts: {
  name: string
  phone: string
  refCode: string
  uplineName: string | null
  uplineRef: string | null
}): string {
  const uplineStr = opts.uplineName
    ? `👑 *Upline :* ${opts.uplineName} (${opts.uplineRef})`
    : `👑 *Upline :* Sans leader communautaire`
  return (
    `🔥 *GreenFlame — Nouvelle inscription*\n\n` +
    `👤 *Nom :* ${opts.name}\n` +
    `📱 *Téléphone :* ${opts.phone}\n` +
    `🔗 *Code :* ${opts.refCode}\n` +
    uplineStr
  )
}

export function waAdminTransaction(opts: {
  buyerName: string
  buyerPhone: string
  merchantName: string
  amount: number
  method: string
  ref: string
}): string {
  return (
    `🔥 *GreenFlame — Transaction*\n\n` +
    `💵 *${opts.amount.toLocaleString('fr-FR')} FCFA*\n` +
    `🛒 *Acheteur :* ${opts.buyerName} (${opts.buyerPhone})\n` +
    `🏪 *Marchand :* ${opts.merchantName}\n` +
    `💳 *Méthode :* ${opts.method}\n` +
    `🔖 Réf : \`${opts.ref}\``
  )
}

export function waAdminWithdrawal(opts: {
  userName: string
  phone: string
  amount: number
  currency: string
  operator: string
}): string {
  return (
    `🔥 *GreenFlame — Demande de retrait*\n\n` +
    `👤 *Utilisateur :* ${opts.userName}\n` +
    `📱 *Téléphone :* ${opts.phone}\n` +
    `💵 *Montant :* ${opts.amount.toLocaleString('fr-FR')} ${opts.currency.toUpperCase()}\n` +
    `📡 *Opérateur :* ${opts.operator.replace('_', ' ').toUpperCase()}`
  )
}

export function waAdminDeposit(opts: {
  agentName: string
  clientName: string
  clientPhone: string
  amount: number
}): string {
  return (
    `🔥 *GreenFlame — Recharge wallet agent*\n\n` +
    `🏪 *Agent :* ${opts.agentName}\n` +
    `👤 *Client :* ${opts.clientName}\n` +
    `📱 *Téléphone :* ${opts.clientPhone}\n` +
    `💵 *Montant :* ${opts.amount.toLocaleString('fr-FR')} FCFA`
  )
}

export function waTontineInvite(opts: {
  memberFirstName: string
  tontineName: string
  creatorName: string
  inviteUrl: string
  resend?: boolean
}): string {
  const intro = opts.resend
    ? `🔔 *Rappel* — ${opts.creatorName} vous a ajouté(e) à une tontine sur GreenFlame.`
    : `🤝 ${opts.creatorName} vous a ajouté(e) à une tontine sur GreenFlame.`
  return (
    `🔥 *GreenFlame — Invitation tontine*\n\n` +
    `${intro}\n\n` +
    `Bonjour ${opts.memberFirstName} 👋\n` +
    `Vous faites partie du groupe *« ${opts.tontineName} »*. Pour confirmer votre place et suivre les cotisations, validez votre invitation :\n\n` +
    `👉 ${opts.inviteUrl}\n\n` +
    `⏱ Ce lien est valable 7 jours.`
  )
}
