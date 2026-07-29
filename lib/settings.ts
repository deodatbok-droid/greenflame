import { createServiceClient } from '@/lib/supabase/server'

export interface PlatformSetting {
  key: string
  value: unknown
  label: string
  description: string | null
  category: 'commissions' | 'gfp' | 'network' | 'platform'
  editable: boolean
  updated_at: string
  updated_by: string | null
}

/**
 * Lit une valeur de paramètre plateforme depuis la DB.
 * Retourne defaultValue si la clé est absente.
 */
export async function getSetting<T = unknown>(key: string, defaultValue: T): Promise<T> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (!data) return defaultValue
  return data.value as T
}

/** Charge tous les paramètres groupés par catégorie. */
export async function getSettingsByCategory(): Promise<Record<string, PlatformSetting[]>> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('platform_settings')
    .select('*')
    .order('key')

  const settings = (data ?? []) as PlatformSetting[]
  return settings.reduce<Record<string, PlatformSetting[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})
}

/** Charge la bannière plateforme. */
export async function getBanner(): Promise<{ enabled: boolean; message: string; type: string } | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('platform_settings')
    .select('key, value')
    .in('key', ['banner_enabled', 'banner_message', 'banner_type'])

  if (!data || data.length === 0) return null

  const map = Object.fromEntries(data.map(d => [d.key, d.value]))
  return {
    enabled: Boolean(map['banner_enabled']),
    message: String(map['banner_message'] ?? '').replace(/^"|"$/g, ''),
    type:    String(map['banner_type']    ?? 'info').replace(/^"|"$/g, ''),
  }
}
