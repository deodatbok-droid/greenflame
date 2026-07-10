/**
 * GreenFlame — Forced Matrix 5×5 : BFS Spillover
 *
 * Algorithme :
 *  1. Si l'enrolleur a un slot disponible → placement direct sous l'enrolleur
 *  2. Sinon → BFS dans l'arbre de l'enrolleur pour trouver le premier nœud éligible
 *     Critères nœud éligible : slot dispo + actif ce mois + ≥2 recrues personnelles
 *  3. Si aucun nœud éligible → ajouter en spillover_queue
 *
 * Distinction clé :
 *   enrolled_by_id  = enrolleur physique (inchangeable, pour les stats de recrutement)
 *   upline_id       = placement effectif dans l'arbre (sponsor des commissions)
 */
import { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000  // 30 jours
const MIN_PERSONAL_RECRUITS = 2                       // recrues enrolled_by pour être éligible

export interface SpilloverResult {
  /** ID du nœud où placer le nouvel affilié (upline_id effectif) */
  placement_upline_id: string
  /** true si le placement est direct chez l'enrolleur */
  is_direct: boolean
  /** true si aucun nœud trouvé → mis en spillover_queue */
  queued: boolean
}

/**
 * Détermine où placer un nouvel inscrit dans l'arbre.
 * @param enrollerId  - L'ID de la personne qui a recruté physiquement
 * @param newUserId   - L'ID du nouvel inscrit (déjà créé, upline_id pas encore fixé)
 * @param service     - Client Supabase service role (bypass RLS)
 */
export async function resolveSpilloverPlacement(
  enrollerId: string,
  newUserId: string,
  service: SupabaseClient,
): Promise<SpilloverResult> {
  // ── Étape 1 : l'enrolleur a-t-il un slot disponible ? ───────────────────
  const { data: enroller } = await service
    .from('users')
    .select('id, max_direct_slots, last_active_at')
    .eq('id', enrollerId)
    .single()

  if (!enroller) {
    // Enrolleur introuvable — placement par défaut sous lui-même, queue
    await addToSpilloverQueue(enrollerId, newUserId, service, 'enroller_not_found')
    return { placement_upline_id: enrollerId, is_direct: true, queued: true }
  }

  const { count: enrollerDirectCount } = await service
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('upline_id', enrollerId)

  const enrollerHasSlot = (enrollerDirectCount ?? 0) < enroller.max_direct_slots

  if (enrollerHasSlot) {
    // Placement direct — pas besoin de vérifier actif/recrues pour le premier placement
    return { placement_upline_id: enrollerId, is_direct: true, queued: false }
  }

  // ── Étape 2 : BFS dans l'arbre de l'enrolleur ───────────────────────────
  const target = await findBfsTarget(enrollerId, service)

  if (target) {
    return { placement_upline_id: target, is_direct: false, queued: false }
  }

  // ── Étape 3 : Aucun nœud éligible → spillover_queue ──────────────────────
  await addToSpilloverQueue(enrollerId, newUserId, service, 'no_eligible_slot')

  // Placement technique sous l'enrolleur même (upline fixé mais en file d'attente)
  // L'admin pourra re-placer manuellement depuis /admin/matrix
  return { placement_upline_id: enrollerId, is_direct: false, queued: true }
}

/**
 * BFS pur : traversée en largeur de l'arbre de l'enrolleur.
 * Retourne l'ID du premier nœud avec slot disponible + actif + ≥2 recrues.
 */
async function findBfsTarget(
  enrollerId: string,
  service: SupabaseClient,
): Promise<string | null> {
  const since30d = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()
  const visited  = new Set<string>([enrollerId])
  let   frontier = [enrollerId]

  // Limiter à 5 niveaux (matrice 5×5 = 3905 nœuds max)
  for (let depth = 0; depth < 5; depth++) {
    if (!frontier.length) break

    // Récupérer tous les nœuds du niveau courant en un seul appel
    const { data: nodes } = await service
      .from('users')
      .select('id, max_direct_slots, last_active_at')
      .in('id', frontier)

    if (!nodes?.length) break

    // Pour chaque nœud, vérifier les 3 critères
    const nodeIds = nodes.map(n => n.id)

    // Comptes directs par nœud (batch)
    const { data: directRows } = await service
      .from('users')
      .select('upline_id')
      .in('upline_id', nodeIds)

    const directCounts: Record<string, number> = {}
    for (const row of directRows ?? []) {
      if (row.upline_id) directCounts[row.upline_id] = (directCounts[row.upline_id] ?? 0) + 1
    }

    // Comptes recrues personnelles par nœud (batch)
    const { data: recruitRows } = await service
      .from('users')
      .select('enrolled_by_id')
      .in('enrolled_by_id', nodeIds)

    const recruitCounts: Record<string, number> = {}
    for (const row of recruitRows ?? []) {
      if (row.enrolled_by_id) recruitCounts[row.enrolled_by_id] = (recruitCounts[row.enrolled_by_id] ?? 0) + 1
    }

    const nextFrontier: string[] = []

    for (const node of nodes) {
      const usedSlots   = directCounts[node.id]   ?? 0
      const hasSlot     = usedSlots < node.max_direct_slots
      const isActive    = !!node.last_active_at && node.last_active_at >= since30d
      const recruitCount = recruitCounts[node.id] ?? 0
      const hasRecruits = recruitCount >= MIN_PERSONAL_RECRUITS

      if (hasSlot && isActive && hasRecruits) {
        return node.id
      }

      // Ajouter les enfants au niveau suivant (BFS)
      const { data: children } = await service
        .from('users')
        .select('id')
        .eq('upline_id', node.id)

      for (const child of children ?? []) {
        if (!visited.has(child.id)) {
          visited.add(child.id)
          nextFrontier.push(child.id)
        }
      }
    }

    frontier = nextFrontier
  }

  return null
}

/**
 * Ajoute un utilisateur en file d'attente spillover.
 */
async function addToSpilloverQueue(
  enrollerId: string,
  newUserId:  string,
  service:    SupabaseClient,
  reason:     string,
): Promise<void> {
  await service.from('spillover_queue').insert({
    new_user_id:    newUserId,
    enrolled_by_id: enrollerId,
    reason,
  })
}

/**
 * Résoudre une entrée de spillover_queue (placement manuel ou automatique).
 * Appelé par l'admin depuis /admin/matrix ou par un cron.
 */
export async function resolveQueueEntry(
  queueId:       string,
  placedUnderId: string,
  service:       SupabaseClient,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()

  // Mettre à jour l'upline_id de l'utilisateur
  const { data: entry } = await service
    .from('spillover_queue')
    .select('new_user_id')
    .eq('id', queueId)
    .is('resolved_at', null)
    .single()

  if (!entry) return { ok: false, error: 'Entrée introuvable ou déjà résolue' }

  const { error: uplineErr } = await service
    .from('users')
    .update({ upline_id: placedUnderId })
    .eq('id', entry.new_user_id)

  if (uplineErr) return { ok: false, error: uplineErr.message }

  await service
    .from('spillover_queue')
    .update({ resolved_at: now, placed_under_id: placedUnderId })
    .eq('id', queueId)

  return { ok: true }
}
