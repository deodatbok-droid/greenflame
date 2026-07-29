import { requireAdmin } from '@/lib/utils/admin-guard'
import { getSettingsByCategory } from '@/lib/settings'
import { createServiceClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  commissions: { label: 'Commissions par catégorie', icon: '💰', desc: 'Taux de commission par type de marchand. Modifiables sans redéploiement.' },
  gfp:         { label: 'Points GreenFlame (GFP)',   icon: '⭐', desc: 'Seuils et règles du système de fidélité.' },
  network:     { label: 'Réseau communautaire',       icon: '🕸️', desc: 'Paramètres de gouvernance opérationnels.' },
  platform:    { label: 'Bannière plateforme',        icon: '📣', desc: 'Annonce globale affichée à tous les utilisateurs connectés.' },
}

const CATEGORY_ORDER = ['commissions', 'gfp', 'network', 'platform']

export default async function SettingsPage() {
  await requireAdmin()
  const svc = createServiceClient()

  const [settingsByCategory, auditRes] = await Promise.all([
    getSettingsByCategory(),
    svc
      .from('platform_settings_audit')
      .select('key, old_value, new_value, changed_at, users:changed_by(full_name)')
      .eq('table_name', 'platform_settings')
      .order('changed_at', { ascending: false })
      .limit(30),
  ])

  const auditLogs = (auditRes.data ?? []) as unknown as Array<{
    key: string
    old_value: unknown
    new_value: unknown
    changed_at: string
    users: { full_name: string } | null
  }>

  // Trier les catégories dans l'ordre défini
  const orderedSettings: Record<string, typeof settingsByCategory[string]> = {}
  for (const cat of CATEGORY_ORDER) {
    if (settingsByCategory[cat]) orderedSettings[cat] = settingsByCategory[cat]
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres plateforme</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paramètres opérationnels — modifications effectives immédiatement, sans redéploiement.
          Les constantes de gouvernance (45/12/40/3) ne figurent pas ici et restent verrouillées dans le code.
        </p>
      </div>

      <SettingsClient
        settingsByCategory={orderedSettings}
        categoryMeta={CATEGORY_META}
        auditLogs={auditLogs}
      />
    </div>
  )
}
