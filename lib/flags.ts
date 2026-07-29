import { createServiceClient } from '@/lib/supabase/server'

export interface FeatureFlag {
  key: string
  label: string
  description: string | null
  category: 'module' | 'feature' | 'market' | 'maintenance'
  enabled: boolean
  mode: 'all' | 'whitelist' | 'blacklist'
  updated_at: string
  updated_by: string | null
}

/**
 * Vérifie si un feature flag est actif pour un utilisateur donné.
 * - Si le flag est disabled → false
 * - Si mode='all' → true
 * - Si mode='whitelist' → true seulement si user_id est dans les overrides allowed=true
 * - Si mode='blacklist' → false si user_id est dans les overrides allowed=false, sinon true
 */
export async function isFeatureEnabled(flagKey: string, userId?: string): Promise<boolean> {
  const svc = createServiceClient()

  const { data: flag } = await svc
    .from('feature_flags')
    .select('enabled, mode')
    .eq('key', flagKey)
    .maybeSingle()

  if (!flag || !flag.enabled) return false
  if (flag.mode === 'all') return true

  if (!userId) return flag.mode === 'blacklist'

  const { data: override } = await svc
    .from('feature_flag_overrides')
    .select('allowed')
    .eq('flag_key', flagKey)
    .eq('user_id', userId)
    .maybeSingle()

  if (override !== null) return Boolean(override.allowed)
  return flag.mode === 'blacklist'
}

/** Charge tous les flags d'une catégorie (pour les pages admin). */
export async function getFlagsByCategory(): Promise<Record<string, FeatureFlag[]>> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('feature_flags')
    .select('*')
    .order('label')

  const flags = (data ?? []) as FeatureFlag[]
  return flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = []
    acc[f.category].push(f)
    return acc
  }, {})
}

/** Retourne le nombre d'overrides pour un flag (whitelist/blacklist). */
export async function getOverrideCount(flagKey: string): Promise<number> {
  const svc = createServiceClient()
  const { count } = await svc
    .from('feature_flag_overrides')
    .select('*', { count: 'exact', head: true })
    .eq('flag_key', flagKey)
  return count ?? 0
}
