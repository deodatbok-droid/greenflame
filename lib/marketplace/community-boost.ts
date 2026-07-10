/**
 * lib/marketplace/community-boost.ts
 *
 * Phase 2 du scoring marketplace — personnalisation par communauté.
 *
 * Principe :
 *   Les marchands qui font partie du réseau de l'acheteur reçoivent un bonus
 *   de classement inversement proportionnel à leur profondeur dans le réseau.
 *   Résultat : l'acheteur voit en premier les produits des marchands les plus
 *   proches dans sa communauté, sans jamais perdre de vue les autres.
 *
 * Barème :
 *   Profondeur 1 (L1 direct) → +35 pts
 *   Profondeur 2             → +25 pts
 *   Profondeur 3             → +15 pts
 *   Profondeur 4             → +10 pts
 *   Profondeur 5             → +5  pts
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// merchant_id → points de bonus communauté
export type BoostMap = Map<string, number>

const DEPTH_BOOST: Record<number, number> = {
  1: 35,
  2: 25,
  3: 15,
  4: 10,
  5: 5,
}

/**
 * Construit la carte de boost communauté pour un utilisateur donné.
 * Retourne une Map vide si l'utilisateur n'est pas connecté ou n'a pas de réseau.
 *
 * Requêtes : 3 (downlines, uplines, marchands) — toutes parallèles.
 */
export async function buildBoostMap(
  supabase: SupabaseClient,
  userId:   string,
): Promise<BoostMap> {

  // Récupérer simultanément les membres sous l'utilisateur (downlines)
  // et au-dessus de lui (uplines), avec la profondeur de chaque lien
  const [downRes, upRes] = await Promise.all([
    supabase
      .from('network_tree')
      .select('descendant_id, depth')
      .eq('ancestor_id', userId)
      .lte('depth', 5),
    supabase
      .from('network_tree')
      .select('ancestor_id, depth')
      .eq('descendant_id', userId)
      .lte('depth', 5),
  ])

  // Construire userId → profondeur minimale
  // (un même utilisateur peut apparaître à plusieurs niveaux via différents chemins)
  const userDepthMap = new Map<string, number>()

  for (const row of (downRes.data ?? [])) {
    const prev = userDepthMap.get(row.descendant_id)
    if (prev === undefined || row.depth < prev) {
      userDepthMap.set(row.descendant_id, row.depth)
    }
  }
  for (const row of (upRes.data ?? [])) {
    const prev = userDepthMap.get(row.ancestor_id)
    if (prev === undefined || row.depth < prev) {
      userDepthMap.set(row.ancestor_id, row.depth)
    }
  }

  if (userDepthMap.size === 0) return new Map()

  // Trouver lesquels sont des marchands actifs
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, user_id')
    .in('user_id', [...userDepthMap.keys()])
    .eq('is_active', true)

  // merchant_id → bonus
  const boostMap: BoostMap = new Map()
  for (const m of (merchants ?? [])) {
    const depth = userDepthMap.get(m.user_id) ?? 5
    boostMap.set(m.id, DEPTH_BOOST[depth] ?? 5)
  }

  return boostMap
}

/** Applique le boost communauté à un score de classement de base. */
export function applyBoost(baseScore: number, merchantId: string, boostMap: BoostMap): number {
  return baseScore + (boostMap.get(merchantId) ?? 0)
}
