/**
 * activate-account.ts
 *
 * Logique d'activation de compte par premier achat.
 *
 * Règle métier GreenFlame :
 *   Un utilisateur sans parrain (aucun l1_upline dans network_tree)
 *   devient automatiquement affilié du marchand lors de son PREMIER achat.
 *   Ce marchand (via son user_id) devient son upline L1 ; les uplines du
 *   marchand cascadent aux niveaux L2–L5 de l'acheteur.
 *
 * Appelé depuis :
 *   - lib/commission-engine/distribute.ts  (cash_confirmed + momo)
 *   - app/api/transactions/route.ts        (wallet_gf)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { insertNotifications } from '@/lib/utils/notify'

type Svc = ReturnType<typeof createServiceClient>

/**
 * maybeActivateAccount
 *
 * Vérifie si l'acheteur est non-parrainé et, si c'est le cas, l'attache
 * au réseau du marchand. Idempotent : si l1_upline est déjà défini, ne fait rien.
 *
 * @param svc        - Client service-role Supabase
 * @param buyerId    - UUID de l'acheteur
 * @param merchantId - UUID du marchand (table merchants, pas users)
 */
export async function maybeActivateAccount(
  svc: Svc,
  buyerId: string,
  merchantId: string,
): Promise<{ activated: boolean; sponsorId?: string }> {
  try {
    // 1. Vérifier si l'acheteur a déjà un l1_upline
    const { data: existingTree } = await svc
      .from('network_tree')
      .select('user_id, l1_upline')
      .eq('user_id', buyerId)
      .maybeSingle()

    if (existingTree?.l1_upline) {
      return { activated: false }  // déjà parrainé
    }

    // 2. Récupérer le user_id du marchand
    const { data: merchant } = await svc
      .from('merchants')
      .select('user_id')
      .eq('id', merchantId)
      .single()

    if (!merchant?.user_id) return { activated: false }
    const sponsorId = merchant.user_id

    // Pas d'auto-parrainage
    if (sponsorId === buyerId) return { activated: false }

    // 3. Récupérer l'arbre du parrain pour cascader les uplines
    const { data: sponsorTree } = await svc
      .from('network_tree')
      .select('l1_upline, l2_upline, l3_upline, l4_upline, tree_path, depth')
      .eq('user_id', sponsorId)
      .maybeSingle()

    const newDepth   = (sponsorTree?.depth ?? 0) + 1
    const basePath   = sponsorTree?.tree_path ?? [sponsorId]
    const newPath    = [...basePath, buyerId]
    const now        = new Date().toISOString()

    const treeEntry = {
      user_id:    buyerId,
      l1_upline:  sponsorId,
      l2_upline:  sponsorTree?.l1_upline  ?? null,
      l3_upline:  sponsorTree?.l2_upline  ?? null,
      l4_upline:  sponsorTree?.l3_upline  ?? null,
      l5_upline:  sponsorTree?.l4_upline  ?? null,
      depth:      newDepth,
      tree_path:  newPath,
      updated_at: now,
    }

    // 4. Insérer ou mettre à jour l'entrée network_tree
    if (existingTree) {
      // Entrée existante sans l1_upline (utilisateur enregistré sans parrain)
      await svc
        .from('network_tree')
        .update(treeEntry)
        .eq('user_id', buyerId)
    } else {
      // Aucune entrée — première inscription sans parrain
      await svc
        .from('network_tree')
        .insert(treeEntry)
    }

    // 5. Activer le compte (premier achat = compte activé)
    await svc.from('users').update({ is_active: true }).eq('id', buyerId)

    // 6. Notifications (non-bloquant)
    //    → Acheteur : confirmation d'activation
    //    → Parrain (marchand) : nouveau filleul
    const { data: buyerProfile } = await svc
      .from('users')
      .select('full_name')
      .eq('id', buyerId)
      .maybeSingle()

    insertNotifications([
      {
        userId:      buyerId,
        type:        'account_activated',
        title:       '🎉 Compte activé !',
        body:        'Vous faites maintenant partie de la communauté GreenFlame. Vos achats génèrent du cashback et des dividendes pour votre communauté.',
        referenceId: merchantId,
      },
      {
        userId:      sponsorId,
        type:        'new_affiliate',
        title:       '🤝 Nouveau membre',
        body:        `${buyerProfile?.full_name ?? 'Un nouveau membre'} vient de rejoindre votre communauté GreenFlame grâce à votre boutique.`,
        referenceId: buyerId,
      },
    ]).catch(() => {})

    return { activated: true, sponsorId }

  } catch (err) {
    // Non-bloquant : log uniquement
    console.error('[maybeActivateAccount] erreur:', err)
    return { activated: false }
  }
}
