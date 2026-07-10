/**
 * GreenFlame — Route USSD
 * POST /api/ussd
 *
 * Africa's Talking envoie un POST multipart/form-data à chaque interaction :
 *   sessionId    : identifiant unique de la session USSD
 *   serviceCode  : shortcode composé (*384# par exemple)
 *   phoneNumber  : numéro de l'utilisateur (+22997XXXXXX)
 *   networkCode  : code opérateur (62001 = MTN Bénin, 62002 = Moov)
 *   text         : saisies cumulées séparées par * (ex: "1*84521*5000*1234")
 *
 * Machine d'états dérivée de `text` (stateless par design) :
 *
 *   ""                     → Menu principal
 *   "1"                    → Payer : demander code marchand
 *   "1*{code}"             → Payer : demander montant
 *   "1*{code}*{montant}"   → Payer : demander PIN
 *   "1*{code}*{mt}*{pin}"  → Payer : traiter et END
 *   "2"                    → Solde → END
 *   "3"                    → 3 dernières transactions → END
 *   "4"                    → Définir/changer PIN : nouveau PIN
 *   "4*{pin}"              → Confirmer PIN
 *   "4*{pin}*{confirm}"    → Sauvegarder PIN → END
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyPin, hashPin } from '@/lib/utils/pin'
import { normalizePhone } from '@/lib/utils/phone'
import { formatFcfa } from '@/lib/utils/format'
import {
  ussdCon, ussdEnd,
  sendSms,
  smsPaiementAcheteur, smsPaiementMarchand,
  smsPinDefini, smsPinBloque,
} from '@/lib/ussd/africastalking'

// ----------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------
const MAX_PIN_ATTEMPTS = 3
const PIN_LOCK_HOURS   = 24

// ----------------------------------------------------------------
// Handler principal
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Africa's Talking envoie du form-data
  const form = await req.formData()
  const sessionId   = (form.get('sessionId')   as string) ?? ''
  const phoneNumber = (form.get('phoneNumber')  as string) ?? ''
  const text        = (form.get('text')         as string) ?? ''

  if (!phoneNumber) return ussdEnd('Numéro invalide.')

  // Normaliser le numéro au format DB canonique
  const phone = normalizePhone(phoneNumber)

  const svc = createServiceClient()

  // Charger l'utilisateur par numéro de téléphone
  const { data: user } = await svc
    .from('users')
    .select('id, full_name, transaction_pin, pin_attempts, pin_locked_until, is_active')
    .eq('phone', phone)
    .single()

  // ── Enregistrer / rafraîchir la session (rate-limiting + débogage)
  await svc.from('ussd_sessions').upsert({
    session_id:    sessionId,
    phone_number:  phone,
    user_id:       user?.id ?? null,
    state:         deriveState(text),
    last_seen_at:  new Date().toISOString(),
    expires_at:    new Date(Date.now() + 3 * 60 * 1000).toISOString(),
  }, { onConflict: 'session_id' })

  // ── Segmenter le texte cumulatif
  const parts = text === '' ? [] : text.split('*')

  // ================================================================
  // MENU PRINCIPAL
  // ================================================================
  if (parts.length === 0) {
    if (!user) {
      return ussdEnd(
        'Bienvenue sur GreenFlame!\n' +
        'Numéro non enregistré.\n' +
        'Inscrivez-vous sur greenflame.bj'
      )
    }
    return ussdCon(
      `Bienvenue ${user.full_name.split(' ')[0]}!\n` +
      '1. Payer un marchand\n' +
      '2. Mon solde\n' +
      '3. Historique\n' +
      '4. Mon code PIN'
    )
  }

  const menu = parts[0]

  // ================================================================
  // OPTION 1 : PAIEMENT
  // ================================================================
  if (menu === '1') {
    if (!user || !user.is_active) {
      return ussdEnd('Compte introuvable ou inactif.\nInscrivez-vous sur greenflame.bj')
    }

    // ── Étape 1 : saisir le code marchand
    if (parts.length === 1) {
      return ussdCon('Code marchand :\n(5 chiffres affichés chez le marchand)\n\nEntrez le code :')
    }

    const shortCode = parts[1]

    // ── Étape 2 : vérifier le code et saisir le montant
    if (parts.length === 2) {
      const { data: merchant } = await svc
        .from('merchants')
        .select('id, business_name, is_active, commission_rate')
        .eq('short_code', shortCode)
        .single()

      if (!merchant || !merchant.is_active) {
        return ussdEnd(`Code ${shortCode} invalide.\nVérifiez le code affiché chez le marchand.`)
      }
      return ussdCon(
        `Marchand : ${merchant.business_name}\n` +
        `Entrez le montant (FCFA) :`
      )
    }

    const amountRaw = parseInt(parts[2].replace(/\D/g, ''), 10)

    // ── Étape 3 : valider montant et demander PIN
    if (parts.length === 3) {
      if (isNaN(amountRaw) || amountRaw < 100) {
        return ussdEnd('Montant invalide.\nMinimum 100 FCFA.')
      }

      // Vérifier que le PIN est configuré
      if (!user.transaction_pin) {
        return ussdEnd(
          'Aucun PIN défini.\n' +
          'Recomposez *XXX# et choisissez\n"4. Mon code PIN" pour en créer un.'
        )
      }

      // Vérifier si PIN bloqué
      if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
        return ussdEnd(
          'PIN bloqué.\nTrop de tentatives incorrectes.\n' +
          'Réessayez dans 24h ou contactez le support.'
        )
      }

      const { data: merchant } = await svc
        .from('merchants')
        .select('business_name')
        .eq('short_code', shortCode)
        .single()

      return ussdCon(
        `Confirmer le paiement :\n` +
        `Marchand : ${merchant?.business_name}\n` +
        `Montant  : ${amountRaw.toLocaleString()} FCFA\n\n` +
        `Entrez votre PIN :`
      )
    }

    // ── Étape 4 : vérifier PIN et traiter la transaction
    if (parts.length === 4) {
      const pinEntered = parts[3]

      // Vérifier PIN bloqué (double check)
      if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
        return ussdEnd('PIN bloqué. Contactez le support GreenFlame.')
      }

      // Vérifier le PIN
      const pinOk = user.transaction_pin ? verifyPin(pinEntered, user.transaction_pin) : false

      if (!pinOk) {
        const newAttempts = (user.pin_attempts ?? 0) + 1
        if (newAttempts >= MAX_PIN_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + PIN_LOCK_HOURS * 3600 * 1000).toISOString()
          await svc.from('users').update({
            pin_attempts: newAttempts,
            pin_locked_until: lockUntil,
          }).eq('id', user.id)
          // SMS d'alerte
          await sendSms({ to: phoneNumber, message: smsPinBloque() })
          return ussdEnd(`PIN incorrect.\nCompte bloqué ${PIN_LOCK_HOURS}h.\nContactez le support.`)
        }
        await svc.from('users').update({ pin_attempts: newAttempts }).eq('id', user.id)
        const restants = MAX_PIN_ATTEMPTS - newAttempts
        return ussdEnd(`PIN incorrect.\n${restants} tentative(s) restante(s).`)
      }

      // PIN OK — réinitialiser les tentatives
      await svc.from('users').update({ pin_attempts: 0, pin_locked_until: null }).eq('id', user.id)

      // Charger le marchand
      const { data: merchant } = await svc
        .from('merchants')
        .select('id, business_name, commission_rate, user_id, total_gmv')
        .eq('short_code', shortCode)
        .single()

      if (!merchant) return ussdEnd('Erreur : marchand introuvable.')

      // Empêcher l'achat dans sa propre boutique
      if (merchant.user_id === user.id) {
        return ussdEnd('Vous ne pouvez pas payer votre propre boutique.')
      }

      // Appeler la même Edge Function que le canal web
      // → redistribution L1-L5 identique, audit trail identique
      const idempotencyKey = `ussd-${sessionId}-${user.id}-${shortCode}-${amountRaw}`

      let txResult: { success: boolean; transactionId?: string; cashback?: { amount: number }; error?: string }

      try {
        const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-transaction`
        const edgeRes = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            merchantId:      merchant.id,
            buyerId:         user.id,
            amountFcfa:      amountRaw,
            paymentMethod:   'wallet_gf',  // USSD utilise le wallet GreenFlame
            idempotencyKey,
          }),
        })
        txResult = await edgeRes.json()
      } catch (err) {
        console.error('[USSD] Edge Function error:', err)
        return ussdEnd('Erreur technique. Réessayez dans quelques instants.')
      }

      // Logger le résultat
      await svc.from('ussd_transaction_log').insert({
        session_id:          sessionId,
        phone_number:        phone,
        action:              'payment',
        status:              txResult.success ? 'success' : 'failed',
        amount_fcfa:         amountRaw,
        merchant_short_code: shortCode,
        transaction_id:      txResult.transactionId ?? null,
        error_message:       txResult.error ?? null,
      })

      if (!txResult.success) {
        const msg = txResult.error === 'Solde insuffisant'
          ? 'Solde GreenFlame insuffisant.\nRechargez votre wallet sur greenflame.bj'
          : `Paiement échoué.\n${txResult.error ?? 'Réessayez.'}`
        return ussdEnd(msg)
      }

      // Récupérer le solde mis à jour
      const { data: wallet } = await svc
        .from('wallets')
        .select('balance_fcfa')
        .eq('user_id', user.id)
        .single()

      const cashbackAmt = txResult.cashback?.amount ?? 0
      const netMarchand = amountRaw - Math.floor(amountRaw * merchant.commission_rate)
      const ref         = txResult.transactionId?.slice(-8).toUpperCase() ?? 'XXXXXXXX'
      const solde       = wallet?.balance_fcfa ?? 0

      // SMS acheteur
      await sendSms({
        to: phoneNumber,
        message: smsPaiementAcheteur({
          merchantName: merchant.business_name,
          amount: amountRaw,
          cashback: cashbackAmt,
          ref: `GF-${ref}`,
          solde,
        }),
      })

      // SMS marchand — récupérer son numéro
      const { data: merchantUser } = await svc
        .from('users')
        .select('phone')
        .eq('id', merchant.user_id)
        .single()

      if (merchantUser?.phone) {
        await sendSms({
          to: merchantUser.phone.startsWith('+') ? merchantUser.phone : `+${merchantUser.phone}`,
          message: smsPaiementMarchand({
            amount: amountRaw,
            net: netMarchand,
            buyerPhone: phoneNumber,
            ref: `GF-${ref}`,
          }),
        })
      }

      return ussdEnd(
        `Paiement reussi!\n` +
        `${merchant.business_name}\n` +
        `${amountRaw.toLocaleString()} FCFA\n` +
        `Ref: GF-${ref}\n` +
        `Cashback: +${cashbackAmt} FCFA\n` +
        `Solde: ${solde.toLocaleString()} FCFA`
      )
    }
  }

  // ================================================================
  // OPTION 2 : SOLDE
  // ================================================================
  if (menu === '2') {
    if (!user) return ussdEnd('Numéro non enregistré.\nInscrivez-vous sur greenflame.bj')

    const { data: wallet } = await svc
      .from('wallets')
      .select('balance_fcfa, balance_gfp, total_earned_fcfa')
      .eq('user_id', user.id)
      .single()

    if (!wallet) return ussdEnd('Wallet introuvable. Contactez le support.')

    const gfpLine = wallet.balance_gfp > 0
      ? `\nPoints GF: ${wallet.balance_gfp.toLocaleString()} GFP`
      : ''

    return ussdEnd(
      `Solde GreenFlame\n` +
      `${user.full_name.split(' ')[0]}\n` +
      `\nDisponible: ${wallet.balance_fcfa.toLocaleString()} FCFA` +
      gfpLine +
      `\nGagne total: ${wallet.total_earned_fcfa.toLocaleString()} FCFA`
    )
  }

  // ================================================================
  // OPTION 3 : HISTORIQUE (3 dernières transactions)
  // ================================================================
  if (menu === '3') {
    if (!user) return ussdEnd('Numéro non enregistré.')

    const { data: txs } = await svc
      .from('transactions')
      .select('amount_fcfa, created_at, merchants:merchant_id(business_name)')
      .eq('buyer_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!txs || txs.length === 0) {
      return ussdEnd('Aucune transaction récente.\nEffectuez votre premier paiement!')
    }

    const lines = txs.map((tx, i) => {
      const merchant = tx.merchants as unknown as { business_name: string } | null
      const date = new Date(tx.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit',
      })
      return `${i + 1}. ${merchant?.business_name?.slice(0, 12) ?? 'Marchand'} ${tx.amount_fcfa.toLocaleString()}F ${date}`
    })

    return ussdEnd(`3 dernières transactions:\n\n${lines.join('\n')}`)
  }

  // ================================================================
  // OPTION 4 : PIN
  // ================================================================
  if (menu === '4') {
    if (!user) return ussdEnd('Numéro non enregistré.')

    // ── Étape 1 : nouveau PIN
    if (parts.length === 1) {
      const action = user.transaction_pin ? 'Changer' : 'Définir'
      return ussdCon(`${action} votre PIN\n\nEntrez un code à 4 chiffres :`)
    }

    const newPin = parts[1]

    // Valider format
    if (!/^\d{4,6}$/.test(newPin)) {
      return ussdEnd('PIN invalide.\nUtilisez 4 à 6 chiffres uniquement.')
    }

    // ── Étape 2 : confirmer le PIN
    if (parts.length === 2) {
      return ussdCon('Confirmez votre PIN :')
    }

    const confirmPin = parts[2]

    // ── Étape 3 : sauvegarder si concordance
    if (parts.length === 3) {
      if (newPin !== confirmPin) {
        return ussdEnd('Les codes ne correspondent pas.\nRecomposez *XXX# pour réessayer.')
      }

      const hashed = hashPin(newPin)
      await svc
        .from('users')
        .update({ transaction_pin: hashed, pin_attempts: 0, pin_locked_until: null })
        .eq('id', user.id)

      await sendSms({ to: phoneNumber, message: smsPinDefini() })

      return ussdEnd('PIN défini avec succès!\nVous pouvez maintenant payer\nvia *XXX# > 1. Payer')
    }
  }

  // ================================================================
  // Fallback : entrée non reconnue
  // ================================================================
  return ussdEnd('Option invalide.\nRecomposez *XXX# pour recommencer.')
}

// Dériver l'état courant depuis le texte (pour le log de session)
function deriveState(text: string): string {
  const parts = text === '' ? [] : text.split('*')
  if (parts.length === 0) return 'MAIN'
  if (parts[0] === '1') {
    const n = parts.length
    if (n === 1) return 'PAY_CODE'
    if (n === 2) return 'PAY_AMOUNT'
    if (n === 3) return 'PAY_PIN'
    if (n === 4) return 'PAY_PROCESS'
  }
  if (parts[0] === '2') return 'BALANCE'
  if (parts[0] === '3') return 'HISTORY'
  if (parts[0] === '4') {
    if (parts.length === 1) return 'PIN_NEW'
    if (parts.length === 2) return 'PIN_CONFIRM'
    if (parts.length === 3) return 'PIN_SAVE'
  }
  return 'UNKNOWN'
}
