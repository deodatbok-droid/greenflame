import { requireAdmin } from '@/lib/utils/admin-guard'
import { getFlagsByCategory } from '@/lib/flags'
import { createServiceClient } from '@/lib/supabase/server'
import FlagsClient from './FlagsClient'

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  module:      { label: 'Modules métier',       icon: '📦', desc: 'Activer/désactiver les modules verticaux (salon, couture, resto…)' },
  feature:     { label: 'Fonctionnalités',       icon: '✨', desc: 'Features spéciales pouvant être réservées à des utilisateurs spécifiques' },
  market:      { label: 'Marchés géographiques', icon: '🌍', desc: 'Contrôle du rollout pays par pays' },
  maintenance: { label: 'Contrôle opérationnel', icon: '🔧', desc: 'Interrupteurs critiques — paiements, inscriptions, KYC' },
}

export default async function FlagsPage() {
  await requireAdmin()
  const svc = createServiceClient()

  const [flagsByCategory, auditRes] = await Promise.all([
    getFlagsByCategory(),
    svc
      .from('platform_settings_audit')
      .select('key, old_value, new_value, changed_at, users:changed_by(full_name)')
      .eq('table_name', 'feature_flags')
      .order('changed_at', { ascending: false })
      .limit(20),
  ])

  const auditLogs = (auditRes.data ?? []) as unknown as Array<{
    key: string
    old_value: Record<string, unknown> | null
    new_value: Record<string, unknown> | null
    changed_at: string
    users: { full_name: string } | null
  }>

  const totalFlags   = Object.values(flagsByCategory).flat().length
  const enabledFlags = Object.values(flagsByCategory).flat().filter(f => f.enabled).length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
          <p className="text-gray-400 text-sm mt-1">
            {enabledFlags}/{totalFlags} features actives · Effets immédiats, sans redéploiement
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-3 py-1.5 rounded-full bg-green-900/30 text-green-400 font-medium">
            {enabledFlags} actifs
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full bg-gray-700 text-gray-400 font-medium">
            {totalFlags - enabledFlags} désactivés
          </span>
        </div>
      </div>

      {/* Alerte maintenance — si payments_enabled est OFF */}
      {flagsByCategory['maintenance']?.find(f => f.key === 'payments_enabled' && !f.enabled) && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-red-300 font-semibold text-sm">Flux de paiement DÉSACTIVÉ</p>
            <p className="text-red-400 text-xs">Aucune transaction ne peut être effectuée sur la plateforme en ce moment.</p>
          </div>
        </div>
      )}

      <FlagsClient flagsByCategory={flagsByCategory} categoryMeta={CATEGORY_META} auditLogs={auditLogs} />
    </div>
  )
}
